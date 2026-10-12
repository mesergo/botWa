import crypto from 'crypto';
import BotSession from '../models/BotSession.js';
import eventBus from '../utils/eventBus.js';

// Rank used to guard against out-of-order webhook delivery: a later webhook
// reporting an earlier status (e.g. 'sent' arriving after 'read') must never
// regress the stored status. 'failed' is terminal and always wins.
const STATUS_RANK = { sent: 1, delivered: 2, read: 3 }; 
const ALLOWED_STATUSES = ['sent', 'delivered', 'read', 'failed'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A 'sent' (and sometimes 'delivered') status webhook can arrive from
// dialog360.js before our own backend has finished saving the outgoing
// message's `wamid` onto its BotSession.process_history entry (the WhatsApp
// send call resolves — and the provider fires its webhook — before
// pushMessagesToWhatsApp()'s caller gets to persist the wamid, especially
// for media messages which have a few seconds of post-send delay baked in).
// Without a retry, that first lookup simply finds nothing and the status is
// dropped forever — which is why 'read'/'failed' (arriving much later) show
// up fine while 'sent'/'delivered' often don't. Retrying a few times with a
// short delay closes this window without needing any change to the send
// path itself.
const FIND_SESSION_RETRIES = 6;
const FIND_SESSION_RETRY_DELAY_MS = 700; // up to ~4.2s total extra wait

const findSessionByWamid = async (wamid) => {
  for (let attempt = 0; attempt <= FIND_SESSION_RETRIES; attempt++) {
    const session = await BotSession.findOne(
      { 'process_history.wamid': wamid },
      { user_id: 1, sender: 1, customer_phone: 1 }
    );
    if (session) return session;
    if (attempt < FIND_SESSION_RETRIES) await sleep(FIND_SESSION_RETRY_DELAY_MS);
  }
  return null;
};

// A 401 used to be completely silent (e.g. when WA_STATUS_WEBHOOK_SECRET was
// missing from .env, every status was dropped for days with no log). Warn, but
// at most once a minute so a burst of rejected webhooks can't flood the log.
const UNAUTHORIZED_WARN_INTERVAL_MS = 60 * 1000;
let lastUnauthorizedWarnAt = 0;
const warnUnauthorized = () => {
  const now = Date.now();
  if (now - lastUnauthorizedWarnAt < UNAUTHORIZED_WARN_INTERVAL_MS) return;
  lastUnauthorizedWarnAt = now;
  console.warn(
    process.env.WA_STATUS_WEBHOOK_SECRET
      ? '[status-webhook] 401 unauthorized: x-status-token missing or does not match WA_STATUS_WEBHOOK_SECRET'
      : '[status-webhook] 401 unauthorized: WA_STATUS_WEBHOOK_SECRET is NOT SET on this server — all delivery statuses are being dropped'
  );
};

const isAuthorized = (req) => {
  const secret = process.env.WA_STATUS_WEBHOOK_SECRET;
  if (!secret) return false;
  const provided = req.headers['x-status-token'] || req.body?.token;
  if (!provided || typeof provided !== 'string') return false;

  const stored = Buffer.from(secret);
  const given = Buffer.from(provided);
  if (stored.length !== given.length) return false;
  return crypto.timingSafeEqual(stored, given);
};

// Applies a single {wamid, status, timestamp, errors} entry: finds the owning
// BotSession by matching wamid inside process_history, rank-guards the
// transition, updates the matching sub-document, and emits the same
// 'session:update' event used elsewhere so the SSE stream / SessionsPage.tsx
// picks it up with no other plumbing changes.
const applyStatusEntry = async ({ wamid, status, timestamp, errors }) => {
  if (!wamid || !status) {
    console.warn('[status-webhook] skipping entry missing wamid/status', { wamid, status });
    return { wamid, status, applied: false, reason: 'missing_fields' };
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    console.warn('[status-webhook] skipping entry with unknown status', { wamid, status });
    return { wamid, status, applied: false, reason: 'unknown_status' };
  }

  const session = await findSessionByWamid(wamid);

  if (!session) {
    console.warn('[status-webhook] no session found for wamid (after retries)', wamid);
    return { wamid, status, applied: false, reason: 'not_found' };
  }

  const deliveryStatusAt = timestamp ? new Date(Number(timestamp) * 1000) : new Date();
  const setFields = {
    'process_history.$[h].deliveryStatus': status,
    'process_history.$[h].deliveryStatusAt': deliveryStatusAt,
  };
  if (errors) {
    setFields['process_history.$[h].deliveryError'] = errors;
  }

  // Every history entry carrying this wamid is updated (text + options can be
  // merged into one WhatsApp message and so share a wamid). The rank guard
  // lives in the arrayFilter so it is evaluated per entry, atomically: a status
  // never moves backwards, and 'failed' is terminal (always wins, never
  // overwritten by a later non-failed status).
  const entryFilter = { 'h.wamid': wamid };
  if (status !== 'failed') {
    const rank = STATUS_RANK[status] || 0;
    entryFilter['h.deliveryStatus'] = {
      $nin: ['failed', ...Object.keys(STATUS_RANK).filter((s) => STATUS_RANK[s] >= rank)],
    };
  }

  // Native collection: process_history is a Mixed array, so Mongoose's
  // arrayFilters casting is unreliable on it.
  const result = await BotSession.collection.updateOne(
    { _id: session._id },
    { $set: setFields },
    { arrayFilters: [entryFilter] }
  );

  if (!result.modifiedCount) {
    console.log('[status-webhook] not applied (stale/duplicate)', { wamid, status });
    return { wamid, status, applied: false, reason: 'stale' };
  }

  const userId = String(session.user_id || '');
  const phone = session.sender || session.customer_phone || '';
  if (userId && phone) {
    eventBus.emit('session:update', { userId, phone: String(phone) });
  }

  return { wamid, status, applied: true };
};

// POST /api/360/status — receives delivery-status webhooks forwarded from
// dialog360.js. Accepts either { statuses: [...] } (batch) or a single
// { wamid, status, timestamp, errors } object.
//
// IMPORTANT: dialog360.js's forward call uses a 5s axios timeout and never
// retries. findSessionByWamid's retry loop alone can take ~4.2s+ (plus Mongo
// query time), so under any extra latency (Mongo hiccups, concurrent status
// bursts, etc.) the combined time regularly exceeded 5s — causing dialog360
// to time out and drop the status, even though we'd often still process it
// successfully moments later. To remove that race entirely, we ack the
// webhook immediately (right after auth/validation) and do the actual
// find+update work after the response is sent, so our response time can
// never cause dialog360's request to time out.
export const updateMessageStatus = async (req, res) => {
  if (!isAuthorized(req)) {
    warnUnauthorized();
    return res.status(401).json({ error: 'unauthorized' });
  }

  const statuses = Array.isArray(req.body?.statuses)
    ? req.body.statuses
    : (req.body?.wamid ? [req.body] : []);

  if (!statuses.length) {
    return res.status(200).json({ accepted: 0 });
  }

  // Ack immediately — dialog360 only checks for a network-level
  // error/timeout (see its `.catch`), it does not inspect the response body,
  // so changing the shape here is safe.
  res.status(200).json({ accepted: statuses.length });

  // Process in the background. Each entry is individually try/caught so one
  // failure can't take down the others or produce an unhandled rejection.
  statuses.forEach((entry) => {
    applyStatusEntry(entry).catch((e) => {
      console.error('[status-webhook] background processing failed:', e.message);
    });
  });
};

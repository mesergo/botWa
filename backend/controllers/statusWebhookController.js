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
      { user_id: 1, sender: 1, customer_phone: 1, 'process_history.$': 1 }
    );
    if (session) return session;
    if (attempt < FIND_SESSION_RETRIES) await sleep(FIND_SESSION_RETRY_DELAY_MS);
  }
  return null;
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

  const existingStatus = session.process_history?.[0]?.deliveryStatus;
  const shouldApply = !existingStatus
    || status === 'failed'
    || (STATUS_RANK[status] || 0) > (STATUS_RANK[existingStatus] || 0);

  if (!shouldApply) {
    return { wamid, status, applied: false, reason: 'stale' };
  }

  const deliveryStatusAt = timestamp ? new Date(Number(timestamp) * 1000) : new Date();
  const setFields = {
    'process_history.$.deliveryStatus': status,
    'process_history.$.deliveryStatusAt': deliveryStatusAt,
  };
  if (errors) {
    setFields['process_history.$.deliveryError'] = errors;
  }

  await BotSession.updateOne(
    { _id: session._id, 'process_history.wamid': wamid },
    { $set: setFields }
  );

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
export const updateMessageStatus = async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const statuses = Array.isArray(req.body?.statuses)
      ? req.body.statuses
      : (req.body?.wamid ? [req.body] : []);

    if (!statuses.length) {
      return res.status(200).json({ results: [] });
    }

    // Applied in parallel — each entry retries independently (see
    // findSessionByWamid), so running them sequentially would needlessly
    // stack up their retry delays when a batch contains several statuses.
    const results = await Promise.all(statuses.map(async (entry) => {
      try {
        return await applyStatusEntry(entry);
      } catch (e) {
        console.error('[status-webhook] failed to apply entry:', e.message);
        return { wamid: entry?.wamid, applied: false, reason: 'error' };
      }
    }));

    return res.status(200).json({ results });
  } catch (e) {
    console.error('[status-webhook] unexpected error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
};

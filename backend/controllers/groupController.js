import mongoose from 'mongoose';
import crypto from 'crypto';
import fetch from 'node-fetch';
import Group from '../models/Group.js';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import GroupBroadcast from '../models/GroupBroadcast.js';
import GroupRemovalLog from '../models/GroupRemovalLog.js';
import { getEffectiveUserId } from '../middleware/auth.js';
 
// ── Broadcast Queue (per-user) ────────────────────────────────────────────────
// Ensures broadcasts for the same user run one at a time, never in parallel.
const broadcastQueues = new Map(); // userId -> { running: boolean, queue: Array }

// ── Scheduled→Completed ticker ────────────────────────────────────────────────
// Every 60s, flip any 'scheduled' broadcast whose scheduled_at has passed to 'completed'.
setInterval(async () => {
  try {
    const result = await GroupBroadcast.updateMany(
      { status: 'scheduled', scheduled_at: { $lte: new Date() } },
      { $set: { status: 'completed', completed_at: new Date() } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[scheduledTicker] Marked ${result.modifiedCount} broadcast(s) as completed`);
    }
  } catch (err) {
    console.error('[scheduledTicker] error:', err);
  }
}, 60_000);

function _getOrCreateQueue(userId) {
  if (!broadcastQueues.has(userId)) {
    broadcastQueues.set(userId, { running: false, queue: [] });
  }
  return broadcastQueues.get(userId);
}

async function _runBroadcastItem(userId, item) {
  const { broadcastId, group, contacts, opts } = item;
  try {
    await processBroadcast(broadcastId, userId, group, contacts, opts);
  } catch (err) {
    console.error(`[broadcastQueue:${broadcastId}] runner error:`, err);
  } finally {
    const userQueue = broadcastQueues.get(userId);
    if (userQueue) {
      if (userQueue.queue.length > 0) {
        const next = userQueue.queue.shift();
        console.log(`[broadcastQueue] ▶ Starting next queued broadcast: ${next.broadcastId} (${next.group.name})`);
        _runBroadcastItem(userId, next).catch(err =>
          console.error(`[broadcastQueue:${next.broadcastId}] runner error:`, err)
        );
      } else {
        userQueue.running = false;
        console.log(`[broadcastQueue] ✅ Queue empty for user ${userId}`);
      }
    }
  }
}

async function enqueueBroadcast(userId, broadcastId, group, contacts, opts) {
  const userQueue = _getOrCreateQueue(userId);
  if (!userQueue.running) {
    userQueue.running = true;
    _runBroadcastItem(userId, { broadcastId, group, contacts, opts }).catch(err =>
      console.error(`[broadcastQueue:${broadcastId}] runner error:`, err)
    );
  } else {
    const position = userQueue.queue.length + 1;
    userQueue.queue.push({ broadcastId, group, contacts, opts });
    console.log(`[broadcastQueue:${broadcastId}] ⏳ Queued at position ${position} — waiting for current broadcast to finish`);
    // Keep status as 'queued' in DB (already is, just log it)
    await GroupBroadcast.findByIdAndUpdate(broadcastId, { status: 'queued' }).catch(() => {});
  }
}

// Returns current queue status for a user (for API/UI feedback)
function getBroadcastQueueStatus(userId) {
  const userQueue = broadcastQueues.get(userId);
  if (!userQueue) return { running: false, queued: 0 };
  return { running: userQueue.running, queued: userQueue.queue.length };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
    
const normalizePhone = (raw = '') => {
  let p = String(raw).replace(/[^0-9]/g, '');
  if (!p) return '';
  p = p.replace(/^0/, '972'); 
  p = p.replace(/^972972/, '972');  
  return p;
};

const ensureBlocklist = async (userId) => {
  let bl = await Group.findOne({ user_id: userId, is_blocklist: true });
  if (!bl) {
    bl = await Group.create({
      user_id: userId,
      name: 'רשימת הסרה',
      is_blocklist: true,
      contact_ids: [],
      phones: [],
    });
  }
  return bl;
};

// ── Groups CRUD ──────────────────────────────────────────────────────────────

// GET /api/groups — list all regular groups (plus blocklist meta)
export const listGroups = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    await ensureBlocklist(userId);

    const groups = await Group.find({ user_id: userId }).sort({ is_blocklist: -1, createdAt: 1 });

    // attach member counts
    const result = groups.map(g => ({
      _id: g._id,
      name: g.name,
      is_blocklist: g.is_blocklist,
      contact_count: g.is_blocklist
        ? (g.phones?.length || 0) + (g.contact_ids?.length || 0)
        : (g.contact_ids?.length || 0),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));

    res.json({ groups: result });
  } catch (err) {
    console.error('[groups.list] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/groups — create a regular group
export const createGroup = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const group = await Group.create({
      user_id: userId,
      name: String(name).trim(),
      is_blocklist: false,
      contact_ids: [],
    });
    res.json(group);
  } catch (err) {
    console.error('[groups.create] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/groups/:id — rename
export const updateGroup = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const group = await Group.findOne({ _id: id, user_id: userId });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.is_blocklist) return res.status(400).json({ error: 'Cannot rename blocklist' });
    group.name = String(name).trim();
    await group.save();
    res.json(group);
  } catch (err) {
    console.error('[groups.update] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/groups/:id
export const deleteGroup = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;
    const group = await Group.findOne({ _id: id, user_id: userId });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.is_blocklist) return res.status(400).json({ error: 'Cannot delete blocklist' });
    await group.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error('[groups.delete] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/groups/:id — full details with members
export const getGroup = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;
    const group = await Group.findOne({ _id: id, user_id: userId });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const contacts = group.contact_ids?.length
      ? await Contact.find({ _id: { $in: group.contact_ids }, user_id: userId })
      : [];

    res.json({
      _id: group._id,
      name: group.name,
      is_blocklist: group.is_blocklist,
      contacts,
      phones: group.phones || [],
    });
  } catch (err) {
    console.error('[groups.get] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/groups/:id/members — add contacts by ids and/or phones
export const addMembers = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;
    const { contact_ids = [], phones = [] } = req.body || {};

    const group = await Group.findOne({ _id: id, user_id: userId });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Resolve incoming phones → existing or new Contact records
    const idSet = new Set(contact_ids.map(String));

    for (const rawPhone of phones) {
      const phone = String(rawPhone || '').trim();
      if (!phone) continue;
      let contact = await Contact.findOne({ user_id: userId, phone });
      if (!contact) {
        contact = await Contact.create({ user_id: userId, phone });
      }
      idSet.add(String(contact._id));
    }

    // Merge unique ids
    const existing = new Set((group.contact_ids || []).map(String));
    for (const cid of idSet) existing.add(cid);
    group.contact_ids = Array.from(existing).map(s => new mongoose.Types.ObjectId(s));

    // Blocklist may also store raw phone strings
    if (group.is_blocklist) {
      const phoneSet = new Set((group.phones || []).map(String));
      for (const rawPhone of phones) {
        const phone = String(rawPhone || '').trim();
        if (phone) phoneSet.add(phone);
      }
      group.phones = Array.from(phoneSet);
    }

    await group.save();
    res.json({ success: true, contact_count: group.contact_ids.length });
  } catch (err) {
    console.error('[groups.addMembers] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/groups/:id/members/:contactId — remove one contact from group
// Body (optional): { reason: string }
export const removeMember = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id, contactId } = req.params;
    const reason = String((req.body && req.body.reason) || req.query.reason || '').trim();
    const group = await Group.findOne({ _id: id, user_id: userId });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.is_blocklist && !reason) {
      return res.status(400).json({ error: 'reason is required when removing from the blocklist' });
    }

    const wasMember = (group.contact_ids || []).some(c => String(c) === String(contactId));
    group.contact_ids = (group.contact_ids || []).filter(c => String(c) !== String(contactId));
    await group.save();

    if (wasMember) {
      // Snapshot contact details so the removal report stays readable.
      let contactSnap = null;
      try {
        contactSnap = await Contact.findOne({ _id: contactId, user_id: userId });
      } catch (_) { /* ignore invalid id */ }
      try {
        await GroupRemovalLog.create({
          user_id: userId,
          group_id: group._id,
          group_name: group.name,
          is_blocklist: !!group.is_blocklist,
          contact_id: contactSnap?._id || null,
          phone: contactSnap?.phone || '',
          full_name: contactSnap?.full_name || '',
          whatsapp_name: contactSnap?.whatsapp_name || '',
          email: contactSnap?.email || '',
          reason,
          removed_by: req.user?.email || req.user?.name || '',
        });
      } catch (logErr) {
        console.error('[groups.removeMember] failed to write removal log:', logErr);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[groups.removeMember] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/groups/removals/log — list removal log entries for current user
// Optional query: group_id, limit (default 200)
export const listRemovals = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { group_id } = req.query || {};
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const filter = { user_id: userId };
    if (group_id) filter.group_id = group_id;
    const items = await GroupRemovalLog.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json({ items });
  } catch (err) {
    console.error('[groups.listRemovals] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/groups/blocklist/phone — add a raw phone (or contact id) to blocklist
export const addToBlocklist = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { phone, contact_id } = req.body || {};
    const bl = await ensureBlocklist(userId);

    if (contact_id) {
      const exists = (bl.contact_ids || []).some(c => String(c) === String(contact_id));
      if (!exists) bl.contact_ids.push(new mongoose.Types.ObjectId(contact_id));
    }
    if (phone) {
      const phoneStr = String(phone).trim();
      if (phoneStr && !(bl.phones || []).includes(phoneStr)) {
        bl.phones.push(phoneStr);
      }
    }
    await bl.save();
    res.json({ success: true });
  } catch (err) {
    console.error('[groups.addToBlocklist] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── Broadcast ────────────────────────────────────────────────────────────────

// Build the set of blocked normalized phones for the user (from both phones[] and contact_ids[])
const getBlockedPhones = async (userId) => {
  const bl = await Group.findOne({ user_id: userId, is_blocklist: true });
  if (!bl) return new Set();
  const phones = new Set((bl.phones || []).map(normalizePhone).filter(Boolean));
  if (bl.contact_ids?.length) {
    const contacts = await Contact.find({ _id: { $in: bl.contact_ids }, user_id: userId });
    for (const c of contacts) {
      const np = normalizePhone(c.phone);
      if (np) phones.add(np);
    }
  }
  return phones;
};

// POST /api/groups/:id/send — enqueue a broadcast (returns immediately, processes in background)
// Body: { message: string, isTemplate?: boolean, templateData?: {...}, bot_id?: string }
export const sendToGroup = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;
    const { message, isTemplate, templateData, media, bot_id, scheduled_at, exclude_group_id } = req.body || {};

    const hasMedia = media && media.url && media.type;
    if (!isTemplate && !hasMedia && (!message || !String(message).trim())) {
      return res.status(400).json({ error: 'message or media is required' });
    }

    const group = await Group.findOne({ _id: id, user_id: userId });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.is_blocklist) {
      return res.status(400).json({ error: 'Cannot broadcast to the blocklist' });
    }

    // Validate scheduled_at if provided
    const scheduledAt = scheduled_at ? Number(scheduled_at) : null;
    if (scheduledAt && (isNaN(scheduledAt) || scheduledAt <= Date.now())) {
      return res.status(400).json({ error: 'scheduled_at must be a future Unix timestamp in milliseconds' });
    }

    let contacts = await Contact.find({ _id: { $in: group.contact_ids }, user_id: userId });

    // Exclude contacts that belong to a specific group
    if (exclude_group_id) {
      const excludeGroup = await Group.findOne({ _id: exclude_group_id, user_id: userId });
      if (excludeGroup && excludeGroup.contact_ids?.length) {
        const excludeSet = new Set(excludeGroup.contact_ids.map(cid => String(cid)));
        contacts = contacts.filter(c => !excludeSet.has(String(c._id)));
        console.log(`[groups.sendToGroup] Excluding group "${excludeGroup.name}" — removed ${group.contact_ids.length - contacts.length} contacts`);
      }
    }
    const msgText = String(message || '').trim();

    // Create broadcast record up-front in 'queued' state
    const broadcast = await GroupBroadcast.create({
      user_id: userId,
      group_id: group._id,
      group_name: group.name,
      is_template: !!isTemplate,
      message: isTemplate ? '' : msgText,
      template_name: isTemplate && templateData ? (templateData.name || '') : '',
      template_language: isTemplate && templateData ? (templateData.language || '') : '',
      template_data: isTemplate ? templateData : undefined,
      media: hasMedia ? media : undefined,
      total: contacts.length,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      status: scheduledAt ? 'scheduled' : 'queued',
      scheduled_at: scheduledAt ? new Date(scheduledAt) : undefined,
      sent_by: req.user?.email || req.user?.name || '',
    });

    // Return immediately — the actual sending runs in the background
    // Check queue BEFORE enqueuing so we can tell the client its position
    const queueStatusBefore = getBroadcastQueueStatus(userId);
    const willBeQueued = queueStatusBefore.running;
    const queuePosition = willBeQueued ? queueStatusBefore.queued + 1 : 0;

    res.json({
      success: true,
      broadcast_id: broadcast._id,
      status: scheduledAt ? 'scheduled' : 'queued',
      total: contacts.length,
      scheduled_at: scheduledAt || undefined,
      // Queue info for UI feedback
      queued_behind: willBeQueued,          // true = waiting for another broadcast to finish
      queue_position: queuePosition,         // 1 = next, 2 = after that, etc.
    });

    // Enqueue — will run immediately if no broadcast is currently running for this user,
    // otherwise waits in queue until the current one finishes.
    enqueueBroadcast(userId, broadcast._id, group, contacts, { isTemplate, templateData, msgText, media: hasMedia ? media : null, bot_id: bot_id || null, scheduled_at: scheduledAt })
      .catch(err => console.error('[groups.processBroadcast] queue error:', err));
  } catch (err) {
    console.error('[groups.sendToGroup] error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

// Background worker: sends one-by-one and updates progress on the broadcast record
async function processBroadcast(broadcastId, userId, group, contacts, opts) {
  const { isTemplate, templateData, msgText, media, bot_id, scheduled_at, resumeFrom } = opts;
  const TAG = `[broadcast:${broadcastId}]`;
  try {
    // התזמון מנוהל על ידי dialog360 — שולחים את כל ההודעות מיד עם שדה `time`
    // dialog360 שומר אותן ב-waitingMessages ומשלח בזמן המתאים, גם לאחר אתחול שרת
    await GroupBroadcast.findByIdAndUpdate(broadcastId, { status: 'running', started_at: new Date() });
    console.log(`${TAG} ▶ Starting broadcast — group="${group.name}" contacts=${contacts.length} bot_id=${bot_id || '(auto)'}${scheduled_at ? ` scheduled_at=${new Date(scheduled_at).toISOString()} (dialog360 will schedule)` : ''}`);

    // Resolve endpoint ID dynamically from the user's first connected bot (without dialog360/ prefix)
    let sheetEndpointId = null;
    {
      const query = bot_id
        ? { _id: bot_id, user_id: userId, endpoint: { $nin: ['', null] } }
        : { user_id: userId, endpoint: { $nin: ['', null] } };
      const bot = await BotFlow.findOne(query);
      if (bot?.endpoint) {
        const ep = bot.endpoint.includes('/') ? bot.endpoint.split('/').pop() : bot.endpoint;
        sheetEndpointId = ep;
      }
    }
    if (!sheetEndpointId) {
      console.error(`${TAG} ❌ No connected bot endpoint found for userId=${userId} — aborting broadcast`);
      await GroupBroadcast.findByIdAndUpdate(broadcastId, { status: 'failed', completed_at: new Date() });
      return;
    }
    const SHEET_URL = `https://wa.message.co.il/api/sheet/15xZeZ7kgS3aNx47Yy3d5flDYtV9Dxw-sij9Wcnio4mQ/test/${sheetEndpointId}/send`;
    const SHEET_TOKEN = crypto.createHash('sha1').update(sheetEndpointId + 'moomoo').digest('hex');
    console.log(`${TAG} 🔌 Resolved endpoint: ${sheetEndpointId}`);

    const blocked = await getBlockedPhones(userId);
    console.log(`${TAG} 🚫 Blocked phones count: ${blocked.size}`);

    // ── בנה מערך טלפונים (סנן חסומים/לא תקינים) ─────────────────────
    const phonesArr = [];
    let skipped = 0;
    const recipients = [];

    for (const contact of contacts) {
      const normalized = normalizePhone(contact.phone);
      const contactName = contact.full_name || contact.whatsapp_name || '';
      if (!normalized) {
        skipped++;
        recipients.push({ phone: contact.phone, name: contactName, status: 'skipped', reason: 'invalid_phone' });
      } else if (blocked.has(normalized)) {
        skipped++;
        recipients.push({ phone: contact.phone, name: contactName, status: 'skipped', reason: 'blocklist' });
      } else {
        phonesArr.push({ phone: normalized, name: contactName });
      }
    }

    console.log(`${TAG} 📋 Valid phones: ${phonesArr.length} | Skipped: ${skipped}`);

    if (phonesArr.length === 0) {
      console.warn(`${TAG} ⚠️ No valid phones to send to — marking completed`);
      await GroupBroadcast.findByIdAndUpdate(broadcastId, {
        status: 'completed', completed_at: new Date(),
        processed: contacts.length, sent: 0, failed: 0, skipped, recipients,
      });
      return;
    }

    // ── Build URL query params (everything except phones goes in URL) ────
    const queryParts = [];
    queryParts.push(`token=${encodeURIComponent(SHEET_TOKEN)}`);
    queryParts.push('force=1');
    queryParts.push(`reportId=${encodeURIComponent(String(broadcastId))}`);

    if (isTemplate && templateData) {
      // סוג 3/4/5/6 — תבנית
      queryParts.push(`template=${encodeURIComponent(templateData.name)}`);
      if (templateData.params?.header?.url) {
        const headerType = templateData.params.header.type || 'image';
        queryParts.push(`header[0][0][link]=${encodeURIComponent(templateData.params.header.url)}`);
        queryParts.push(`header[0][1]=${encodeURIComponent(headerType)}`);
      }
      if (Array.isArray(templateData.params?.body) && templateData.params.body.length > 0) {
        templateData.params.body.forEach((p, i) => {
          const s = String(p || '');
          // __field:full_name / whatsapp_name → $name$ (מוחלף אוטומטית לכל נמען ע"י ה-API)
          let val = s;
          if (s === '__field:full_name' || s === '__field:whatsapp_name') val = '$name$';
          else if (s.startsWith('__field:')) val = '';
          queryParts.push(`params[${i}]=${encodeURIComponent(val)}`);
        });
      }
    } else if (media?.url && media?.type) {
      // מדיה חופשית — שלח את ה-URL כטקסט
      queryParts.push(`text=${encodeURIComponent(msgText || media.url)}`);
    } else {
      // סוג 1/2 — טקסט פשוט
      queryParts.push(`text=${encodeURIComponent(msgText)}`);
    }

    if (scheduled_at) queryParts.push(`time=${scheduled_at}`);

    const fullUrl = `${SHEET_URL}?${queryParts.join('&')}`;

    // Body: only phones as flat array of strings
    const body = { phones: phonesArr.map(p => p.phone) };

    console.log(`${TAG} 📤 POST ${fullUrl}`);
    console.log(`${TAG}   → phones: ${phonesArr.length} | template: ${isTemplate ? (templateData?.name || 'N/A') : 'N/A'} | text: ${!isTemplate ? String(msgText || '').substring(0, 50) : 'N/A'} | reportId: ${broadcastId}`);
    console.log(`${TAG} 📦 Full request body: ${JSON.stringify(body)}`);

    const waRes = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    const responseText = await waRes.text().catch(() => '');
    console.log(`${TAG} ← HTTP ${waRes.status}`);
    console.log(`${TAG} ← Response body: ${responseText.substring(0, 1000)}`);

    if (waRes.ok) {
      console.log(`${TAG} ✅ Batch sent to ${phonesArr.length} numbers — waiting for /complete callback`);
      // status נשאר 'running' — completeBroadcast callback יעדכן ל-'completed'
      await GroupBroadcast.findByIdAndUpdate(broadcastId, {
        processed: phonesArr.length + skipped,
        sent: phonesArr.length,
        skipped,
        recipients,
      });
    } else {
      console.error(`${TAG} ❌ Sheet API error: HTTP ${waRes.status} — ${responseText}`);
      await GroupBroadcast.findByIdAndUpdate(broadcastId, {
        status: 'failed', completed_at: new Date(),
        processed: contacts.length, sent: 0, failed: phonesArr.length, skipped,
        errors: [{ error: `Sheet API HTTP ${waRes.status}: ${responseText.substring(0, 200)}` }],
        recipients,
      });
    }
  } catch (err) {
    console.error(`${TAG} 💥 Unexpected error:`, err);
    await GroupBroadcast.findByIdAndUpdate(broadcastId, {
      status: 'failed',
      completed_at: new Date(),
      errors: [{ error: err.message }],
    }).catch(() => {});
  }
}

// ── Broadcast history ────────────────────────────────────────────────────────

// DELETE /api/groups/broadcasts/:id/cancel — cancel a scheduled broadcast
export const cancelBroadcast = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;

    const broadcast = await GroupBroadcast.findOne({ _id: id, user_id: userId });
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
    if (broadcast.status !== 'scheduled') {
      return res.status(400).json({ error: `Cannot cancel a broadcast with status "${broadcast.status}". Only scheduled broadcasts can be cancelled.` });
    }

    const taskids = broadcast.taskids || [];
    console.log(`[cancelBroadcast:${id}] broadcast.status=${broadcast.status} taskids.length=${taskids.length}`);
    console.log(`[cancelBroadcast:${id}] taskids content: ${JSON.stringify(taskids)}`);
    if (taskids.length === 0) {
      console.warn(`[cancelBroadcast:${id}] ⚠️ No taskids saved — dialog360 may not have returned taskid during send, or send is still in progress. Messages may NOT be cancelled in dialog360.`);
    }

    // Resolve the endpoint + token (same logic as processBroadcast)
    let endpoint = null;
    let waToken = null;
    const userBots = await BotFlow.find({ user_id: userId, endpoint: { $nin: ['', null] } });
    console.log(`[cancelBroadcast:${id}] found ${userBots.length} bot(s) with endpoint`);
    if (userBots.length === 1) {
      const bot = userBots[0];
      endpoint = bot.endpoint.includes('/') ? bot.endpoint : `dialog360/${bot.endpoint}`;
      const endpointId = endpoint.split('/').pop();
      waToken = crypto.createHash('sha1').update(endpointId + 'moomoo').digest('hex');
      console.log(`[cancelBroadcast:${id}] ✅ endpoint resolved: ${endpoint} (bot: ${bot.name})`);
    } else if (userBots.length > 1) {
      // Try to find bot from broadcast's group info — fall back to first bot
      const bot = userBots[0];
      endpoint = bot.endpoint.includes('/') ? bot.endpoint : `dialog360/${bot.endpoint}`;
      const endpointId = endpoint.split('/').pop();
      waToken = crypto.createHash('sha1').update(endpointId + 'moomoo').digest('hex');
      console.log(`[cancelBroadcast:${id}] ✅ multiple bots — using first: ${endpoint} (bot: ${bot.name})`);
    } else {
      console.error(`[cancelBroadcast:${id}] ❌ No bots with endpoint found — cannot call dialog360 /unsend`);
    }

    let cancelled = 0;
    let cancelErrors = 0;

    if (endpoint && taskids.length > 0) {
      console.log(`[cancelBroadcast:${id}] Starting /unsend loop for ${taskids.length} taskid(s)...`);
      const unsendUrl = `https://wa.message.co.il/api/${endpoint}/unsend`;
      for (const { taskid, contact_phone } of taskids) {
        try {
          const unsendBody = JSON.stringify({ id: taskid });
          console.log(`[cancelBroadcast:${id}] → POST ${unsendUrl} body=${unsendBody}`);
          const r = await fetch(unsendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: waToken },
            body: unsendBody,
          });
          const rText = await r.text().catch(() => '');
          console.log(`[cancelBroadcast:${id}] ← HTTP ${r.status} body="${rText}"`);
          if (r.ok) {
            cancelled++;
            console.log(`[cancelBroadcast:${id}] ✅ Unsent taskid=${taskid} phone=${contact_phone}`);
          } else {
            cancelErrors++;
            console.warn(`[cancelBroadcast:${id}] ⚠️ Unsend failed for taskid=${taskid}: HTTP ${r.status} — ${rText}`);
          }
        } catch (e) {
          cancelErrors++;
          console.error(`[cancelBroadcast:${id}] ❌ Unsend error for taskid=${taskid}:`, e.message);
        }
      }
    } else {
      if (!endpoint) console.warn(`[cancelBroadcast:${id}] ⚠️ Skipping dialog360 unsend — no endpoint resolved`);
      if (taskids.length === 0) console.warn(`[cancelBroadcast:${id}] ⚠️ Skipping dialog360 unsend — taskids array is empty`);
    }
    console.log(`[cancelBroadcast:${id}] Summary: cancelled=${cancelled} cancelErrors=${cancelErrors} total=${taskids.length}`);

    await GroupBroadcast.findByIdAndUpdate(id, {
      status: 'cancelled',
      cancelled_at: new Date(),
    });
    console.log(`[cancelBroadcast:${id}] ✅ Broadcast marked as cancelled in DB`);

    res.json({ success: true, cancelled, cancelErrors, total: taskids.length });
  } catch (err) {
    console.error('[groups.cancelBroadcast] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/groups/broadcasts — list all broadcasts for the user (optionally filter by group)
// Query: ?group_id=...&limit=50
export const listBroadcasts = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { group_id } = req.query || {};
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const filter = { user_id: userId };
    if (group_id) filter.group_id = group_id;

    const items = await GroupBroadcast.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-recipients'); // omit heavy field in list view

    res.json({ broadcasts: items });
  } catch (err) {
    console.error('[groups.listBroadcasts] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/groups/broadcasts/:id — full broadcast details (with recipients)
export const getBroadcast = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;
    const item = await GroupBroadcast.findOne({ _id: id, user_id: userId });
    if (!item) return res.status(404).json({ error: 'Broadcast not found' });
    res.json(item);
  } catch (err) {
    console.error('[groups.getBroadcast] error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/groups/broadcasts/:id/resume — continue a stopped/failed broadcast from where it left off
export const resumeBroadcast = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;

    const broadcast = await GroupBroadcast.findOne({ _id: id, user_id: userId });
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });

    if (broadcast.status === 'running') {
      // Allow resume if the broadcast is "orphaned" (server restarted, lost in-memory process)
      // Detect by checking if updatedAt is more than 3 minutes ago (no live updates = dead process)
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      const isOrphaned = !broadcast.updatedAt || broadcast.updatedAt < threeMinutesAgo;
      if (!isOrphaned) {
        return res.status(400).json({ error: 'Broadcast is currently running — try again in a few minutes if it appears stuck' });
      }
      console.log(`[groups.resumeBroadcast] Broadcast ${id} has status=running but updatedAt=${broadcast.updatedAt?.toISOString()} — orphaned after server restart, allowing resume`);
    }
    if (broadcast.status === 'completed') {
      return res.status(400).json({ error: 'Broadcast already completed successfully' });
    }

    const queueStatus = getBroadcastQueueStatus(userId);
    const group = await Group.findOne({ _id: broadcast.group_id, user_id: userId });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Build set of phones already successfully sent (from previous run's recipients)
    const alreadySentPhones = new Set(
      (broadcast.recipients || [])
        .filter(r => r.status === 'sent')
        .map(r => normalizePhone(r.phone))
        .filter(Boolean)
    );

    // Get current group contacts and filter to only those not yet sent
    const allContacts = await Contact.find({ _id: { $in: group.contact_ids }, user_id: userId });
    const remainingContacts = allContacts.filter(c => {
      const np = normalizePhone(c.phone);
      return !np || !alreadySentPhones.has(np);
    });

    console.log(`[groups.resumeBroadcast] broadcast=${id} group="${group.name}" already_sent=${alreadySentPhones.size} remaining=${remainingContacts.length}`);

    if (remainingContacts.length === 0) {
      await GroupBroadcast.findByIdAndUpdate(id, { status: 'completed', completed_at: new Date() });
      return res.json({ success: true, message: 'All contacts already sent — marked as completed', remaining: 0 });
    }

    // Reset broadcast to queued state
    await GroupBroadcast.findByIdAndUpdate(id, {
      status: 'queued',
      completed_at: null,
    });

    const opts = {
      isTemplate: broadcast.is_template,
      templateData: broadcast.template_data,
      msgText: broadcast.message,
      media: broadcast.media || null,
      bot_id: null, // auto-detect
      scheduled_at: broadcast.scheduled_at ? new Date(broadcast.scheduled_at).getTime() : null,
      // Carry forward existing stats so totals accumulate correctly
      resumeFrom: {
        sent: broadcast.sent || 0,
        failed: broadcast.failed || 0,
        skipped: broadcast.skipped || 0,
        processed: broadcast.processed || 0,
        totalOriginal: broadcast.total || 0,
        recipients: broadcast.recipients || [],
        errors: broadcast.errors || [],
      },
    };

    res.json({
      success: true,
      broadcast_id: broadcast._id,
      status: queueStatus.running ? 'queued' : 'starting',
      already_sent: alreadySentPhones.size,
      remaining: remainingContacts.length,
      total: broadcast.total,
      queue_position: queueStatus.running ? queueStatus.queued + 1 : 0,
    });

    enqueueBroadcast(userId, broadcast._id, group, remainingContacts, opts)
      .catch(err => console.error('[groups.resumeBroadcast] queue error:', err));
  } catch (err) {
    console.error('[groups.resumeBroadcast] error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};


// GET /api/groups/broadcasts/:id/complete — mark a broadcast as completed
export const completeBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[completeBroadcast] ✅ Callback received for broadcast id=${id} method=${req.method} query=${JSON.stringify(req.query)} body=${JSON.stringify(req.body)}`);
    const broadcast = await GroupBroadcast.findById(id);
    if (!broadcast) {
      console.warn(`[completeBroadcast] ⚠️ Broadcast ${id} not found`);
      return res.status(404).json({ error: 'Broadcast not found' });
    }
    console.log(`[completeBroadcast] Broadcast ${id} — current status: ${broadcast.status} → setting to completed`);
    broadcast.status = 'completed';
    broadcast.completed_at = new Date();
    await broadcast.save();
    console.log(`[completeBroadcast] ✅ Broadcast ${id} marked as completed`);
    res.json({ success: true });
  } catch (err) {
    console.error('[groups.completeBroadcast] error:', err);
    res.status(500).json({ error: err.message });
  }
};

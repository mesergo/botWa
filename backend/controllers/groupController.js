import mongoose from 'mongoose';
import crypto from 'crypto';
import fetch from 'node-fetch';
import Group from '../models/Group.js';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import GroupBroadcast from '../models/GroupBroadcast.js';
import GroupRemovalLog from '../models/GroupRemovalLog.js';
import { getEffectiveUserId } from '../middleware/auth.js';

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
// Body: { message: string, isTemplate?: boolean, templateData?: {...} }
export const sendToGroup = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;
    const { message, isTemplate, templateData, media } = req.body || {};

    const hasMedia = media && media.url && media.type;
    if (!isTemplate && !hasMedia && (!message || !String(message).trim())) {
      return res.status(400).json({ error: 'message or media is required' });
    }

    const group = await Group.findOne({ _id: id, user_id: userId });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.is_blocklist) {
      return res.status(400).json({ error: 'Cannot broadcast to the blocklist' });
    }

    const contacts = await Contact.find({ _id: { $in: group.contact_ids }, user_id: userId });
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
      status: 'queued',
      sent_by: req.user?.email || req.user?.name || '',
    });

    // Return immediately — the actual sending runs in the background
    res.json({
      success: true,
      broadcast_id: broadcast._id,
      status: 'queued',
      total: contacts.length,
    });

    // Fire & forget — process in background
    processBroadcast(broadcast._id, userId, group, contacts, { isTemplate, templateData, msgText, media: hasMedia ? media : null })
      .catch(err => console.error('[groups.processBroadcast] background error:', err));
  } catch (err) {
    console.error('[groups.sendToGroup] error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

// Background worker: sends one-by-one and updates progress on the broadcast record
async function processBroadcast(broadcastId, userId, group, contacts, opts) {
  const { isTemplate, templateData, msgText, media } = opts;
  try {
    await GroupBroadcast.findByIdAndUpdate(broadcastId, { status: 'running', started_at: new Date() });

    const blocked = await getBlockedPhones(userId);
    const user = await User.findById(userId);
    let endpoint, waToken;
    if (user && user.dialog360_bot_id) {
      endpoint = `dialog360/${user.dialog360_bot_id}`;
      waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
    } else {
      endpoint = null;
      waToken = null;
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let processed = 0;
    const errors = [];
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
        let waBody;
        if (isTemplate && templateData) {
          waBody = {
            chat: normalized,
            template: templateData.name,
            language: templateData.language || 'he',
            fromMe: 1,
          };
          if (templateData.params) {
            if (templateData.params.header && templateData.params.header.url) {
              const mediaType = templateData.params.header.type || 'image';
              waBody.header = [{ type: mediaType, [mediaType]: { link: templateData.params.header.url } }];
            }
            if (Array.isArray(templateData.params.body)) {
              waBody.params = templateData.params.body.filter(p => p && String(p).trim());
            }
          }
        } else if (media && media.url && media.type) {
          // Free-form media (image/video/document/audio) with optional caption (msgText)
          const mediaType = String(media.type).toLowerCase();
          const mediaPayload = { link: media.url };
          if (msgText && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
            mediaPayload.caption = msgText;
          }
          if (mediaType === 'document' && media.filename) {
            mediaPayload.filename = media.filename;
          }
          waBody = { phone: normalized, [mediaType]: mediaPayload, fromMe: 1 };
        } else {
          waBody = { phone: normalized, text: msgText, fromMe: 1 };
        }

        try {
          const waRes = await fetch(`https://wa.message.co.il/api/${endpoint}/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              Accept: 'application/json',
              token: waToken,
            },
            body: JSON.stringify(waBody),
          });
          if (waRes.ok) {
            sent++;
            recipients.push({ phone: contact.phone, name: contactName, status: 'sent' });
          } else {
            failed++;
            const txt = await waRes.text().catch(() => '');
            errors.push({ phone: contact.phone, status: waRes.status, error: txt.substring(0, 200) });
            recipients.push({ phone: contact.phone, name: contactName, status: 'failed', error: txt.substring(0, 200) });
          }
        } catch (e) {
          failed++;
          errors.push({ phone: contact.phone, error: e.message });
          recipients.push({ phone: contact.phone, name: contactName, status: 'failed', error: e.message });
        }

        // Small throttle to avoid hammering the API (200ms between sends)
        await new Promise(r => setTimeout(r, 200));
      }

      processed++;

      // Update progress every 5 messages (or on the last)
      if (processed % 5 === 0 || processed === contacts.length) {
        await GroupBroadcast.findByIdAndUpdate(broadcastId, {
          processed, sent, failed, skipped,
        }).catch(() => {});
      }
    }

    await GroupBroadcast.findByIdAndUpdate(broadcastId, {
      status: 'completed',
      processed,
      sent,
      failed,
      skipped,
      errors: errors.slice(0, 50),
      recipients,
      completed_at: new Date(),
    });
  } catch (err) {
    console.error('[groups.processBroadcast] error:', err);
    await GroupBroadcast.findByIdAndUpdate(broadcastId, {
      status: 'failed',
      completed_at: new Date(),
      errors: [{ error: err.message }],
    }).catch(() => {});
  }
}

// ── Broadcast history ────────────────────────────────────────────────────────

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


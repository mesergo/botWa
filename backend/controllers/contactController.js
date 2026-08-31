import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import BotSession from '../models/BotSession.js';
import Group from '../models/Group.js';
import { getEffectiveUserId } from '../middleware/auth.js';
import { normalizePhone } from '../utils/phone.js';
import XLSX from 'xlsx';
import fs from 'fs';

// GET /api/contacts — paginated list of contacts for the current user
export const getContacts = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const search = (req.query.search || '').trim();

  try {
    const filter = { user_id: userId };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { phone: re },
        { full_name: re },
        { whatsapp_name: re },
        { email: re },
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Contact.countDocuments(filter),
    ]);

    res.json({ contacts, total, page, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/contacts/:id — single contact
export const getContact = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const contact = await Contact.findOne({ _id: req.params.id, user_id: userId });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Syncs a contact's distribution-list membership: adds it to the groups in
// `groupIds` and removes it from any of the user's other (non-blocklist) groups.
// Only runs when `groupIds` is an array (undefined/omitted means "don't touch groups").
const syncContactGroups = async (userId, contactId, groupIds) => {
  if (!Array.isArray(groupIds)) return;
  const validIds = groupIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  await Promise.all([
    Group.updateMany(
      { _id: { $in: validIds }, user_id: userId, is_blocklist: false },
      { $addToSet: { contact_ids: contactId } }
    ),
    Group.updateMany(
      { _id: { $nin: validIds }, user_id: userId, is_blocklist: false },
      { $pull: { contact_ids: contactId } }
    ),
  ]);
};

// POST /api/contacts — create a new contact (or upsert by phone)
export const createContact = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { phone, full_name, whatsapp_name, email, custom_field_values, groupIds } = req.body;

  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Phone is required' });
  }

  const normalizedPhone = normalizePhone(phone.trim());

  try {
    const contact = await Contact.findOneAndUpdate(
      { user_id: userId, phone: normalizedPhone },
      { $set: { full_name: full_name || '', whatsapp_name: whatsapp_name || '', email: email || '', custom_field_values: custom_field_values || {} } },
      { upsert: true, new: true, runValidators: true }
    );
    await syncContactGroups(userId, contact._id, groupIds);
    res.json(contact);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Contact with this phone already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/contacts/:id — update existing contact
export const updateContact = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { phone, full_name, whatsapp_name, email, custom_field_values, groupIds } = req.body;

  try {
    const update = { full_name: full_name || '', whatsapp_name: whatsapp_name || '', email: email || '' };
    if (phone && phone.trim()) update.phone = normalizePhone(phone.trim());
    if (custom_field_values !== undefined) update.custom_field_values = custom_field_values;

    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, user_id: userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    await syncContactGroups(userId, contact._id, groupIds);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/contacts/groups-map — returns a map of contactId -> [{_id, name}] for all non-blocklist groups
export const getContactGroupsMap = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const groups = await Group.find({ user_id: userId, is_blocklist: false }).select('_id name contact_ids');
    const map = {};
    for (const g of groups) {
      for (const cid of g.contact_ids) {
        const key = cid.toString();
        if (!map[key]) map[key] = [];
        map[key].push({ _id: g._id, name: g.name });
      }
    }
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/contacts/:id
export const deleteContact = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, user_id: userId });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/contacts/upsert-by-phone
// Used internally (e.g. by chat flow when a bot input saves contact data)
export const upsertContactByPhone = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { phone, full_name, whatsapp_name, email, custom_field_values } = req.body;

  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Phone is required' });
  }

  const normalizedPhone = normalizePhone(phone.trim());

  try {
    const setFields = {};
    if (full_name !== undefined) setFields.full_name = full_name;
    if (whatsapp_name !== undefined) setFields.whatsapp_name = whatsapp_name;
    if (email !== undefined) setFields.email = email;
    if (custom_field_values && typeof custom_field_values === 'object') {
      Object.entries(custom_field_values).forEach(([k, v]) => {
        setFields[`custom_field_values.${k}`] = v;
      });
    }

    const contact = await Contact.findOneAndUpdate(
      { user_id: userId, phone: normalizedPhone },
      { $set: setFields },
      { upsert: true, new: true }
    );
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/contacts/import — bulk import from Excel/CSV file
export const importContacts = async (req, res) => {
  const userId = getEffectiveUserId(req);
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // groupIds may be sent as a JSON-encoded array in the FormData field
  let groupIds = [];
  try {
    if (req.body.groupIds) {
      const parsed = JSON.parse(req.body.groupIds);
      if (Array.isArray(parsed)) {
        groupIds = parsed.filter(id => mongoose.Types.ObjectId.isValid(id));
      }
    }
  } catch { /* ignore malformed groupIds */ }

  const filePath = req.file.path;
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    let created = 0, updated = 0;
    const skipped = []; // { row, phone, reason }
    const errors = []; // { row, phone, error }
    const importedContactIds = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +1 for 0-index, +1 for header row

      // Column headers can carry stray leading/trailing whitespace (common in
      // files exported from other systems) — normalize keys before reading them
      const cell = {};
      for (const key of Object.keys(row)) cell[key.trim()] = row[key];

      // Accept Hebrew or English column headers
      const rawPhone = String(
        cell['טלפון'] ?? cell['phone'] ?? cell['Phone'] ?? ''
      ).trim();
      const phone = normalizePhone(rawPhone);

      // Full name is optional — a phone number alone is enough to import a contact
      const full_name = String(cell['שם מלא'] ?? cell['full_name'] ?? cell['Full Name'] ?? '').trim();

      if (!phone) {
        skipped.push({ row: rowNumber, phone: rawPhone, reason: 'מספר טלפון חסר' });
        continue;
      }
      const whatsapp_name = String(cell['שם וואטסאפ'] ?? cell['whatsapp_name'] ?? cell['WhatsApp Name'] ?? '').trim();
      const email = String(cell['מייל'] ?? cell['email'] ?? cell['Email'] ?? '').trim();

      try {
        const result = await Contact.findOneAndUpdate(
          { user_id: userId, phone },
          { $set: { full_name, email } },
          { upsert: true, new: true, includeResultMetadata: true }
        );
        importedContactIds.push(result.value._id);
        if (result.lastErrorObject?.updatedExisting) updated++;
        else created++;
      } catch (e) {
        errors.push({ row: rowNumber, phone, error: e.message });
      }
    }

    // Assign imported contacts to selected groups
    if (groupIds.length > 0 && importedContactIds.length > 0) {
      await Group.updateMany(
        { _id: { $in: groupIds }, user_id: userId, is_blocklist: false },
        { $addToSet: { contact_ids: { $each: importedContactIds } } }
      );
    }

    res.json({
      imported: created + updated,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to parse file: ' + err.message });
  } finally {
    fs.unlink(filePath, () => {});
  }
};

// PATCH /api/contacts/assign-rep — assign or unassign a rep from a contact
export const assignRep = async (req, res) => {
  if (req.user?.role === 'rep') {
    return res.status(403).json({ error: 'אין הרשאה' });
  }
  const userId = getEffectiveUserId(req);
  const { phone: rawPhone, rep_id, action } = req.body;

  if (!rawPhone || !rep_id || !['assign', 'unassign'].includes(action)) {
    return res.status(400).json({ error: 'שדות חסרים או לא תקינים' });
  }
  if (!mongoose.Types.ObjectId.isValid(rep_id)) {
    return res.status(400).json({ error: 'rep_id לא תקין' });
  }

  const phone = normalizePhone(rawPhone);

  try {
    const update = action === 'assign'
      ? { $addToSet: { assigned_to: new mongoose.Types.ObjectId(rep_id) } }
      : { $pull: { assigned_to: new mongoose.Types.ObjectId(rep_id) } };

    const options = { new: true };
    if (action === 'assign') options.upsert = true;

    const contact = await Contact.findOneAndUpdate(
      { user_id: userId, phone },
      update,
      options
    );

    // When assigning a rep, immediately flip the latest conversation of this
    // contact from 'bot' to 'waiting' (ממתין למענה) so the rep doesn't see it
    // as still being handled by the bot.
    if (action === 'assign') {
      try {
        const latest = await BotSession.findOne({
          $and: [
            { $or: [{ sender: phone }, { customer_phone: phone }] },
            { $or: [{ user_id: userId }, { user_id: String(userId) }] }
          ]
        }).sort({ createdAt: -1 });
        if (latest && latest.status !== 'closed') {
          latest.status = 'waiting';
          latest.is_agent = true;
          latest.agent_since = new Date();
          latest.rep_user_id = String(rep_id);
          await latest.save();
        }
      } catch (e) {
        console.error('[assignRep] failed to update session status:', e.message);
      }
    }

    res.json({ success: true, assigned_to: (contact?.assigned_to || []).map(id => id.toString()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

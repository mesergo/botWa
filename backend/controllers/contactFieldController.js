import ContactFieldDef from '../models/ContactFieldDef.js';
import { getEffectiveUserId } from '../middleware/auth.js';

// GET /api/contact-fields
export const getFields = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const fields = await ContactFieldDef.find({ user_id: userId }).sort({ order: 1, createdAt: 1 });
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Derive a stable slug key from a label (preserves Hebrew and Latin chars)
const toSlugKey = (label) =>
  label.trim().replace(/\s+/g, '_').replace(/[^\w\u0590-\u05FF]/g, '');

// POST /api/contact-fields
export const createField = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { label, order } = req.body;
  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'label is required' });
  }
  const baseKey = toSlugKey(label);
  if (!baseKey) {
    return res.status(400).json({ error: 'label must contain at least one valid character' });
  }
  try {
    // Ensure key uniqueness per user: append _2, _3, ... if needed
    let key = baseKey;
    let suffix = 2;
    while (await ContactFieldDef.exists({ user_id: userId, key })) {
      key = `${baseKey}_${suffix++}`;
    }
    const field = await ContactFieldDef.create({
      user_id: userId,
      label: label.trim(),
      key,
      order: order ?? 0,
    });
    res.status(201).json(field);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/contact-fields/:id
export const updateField = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { label, order } = req.body;
  try {
    const field = await ContactFieldDef.findOneAndUpdate(
      { _id: req.params.id, user_id: userId },
      { $set: { ...(label !== undefined && { label: label.trim() }), ...(order !== undefined && { order }) } },
      { new: true, runValidators: true }
    );
    if (!field) return res.status(404).json({ error: 'Field not found' });
    res.json(field);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/contact-fields/:id
export const deleteField = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const field = await ContactFieldDef.findOneAndDelete({ _id: req.params.id, user_id: userId });
    if (!field) return res.status(404).json({ error: 'Field not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

import mongoose from 'mongoose';
import User from '../models/User.js';
import RepGroup from '../models/RepGroup.js';

// Returns the root company manager ID for the given userId.
// If the user is a sub-user (has a manager_id), returns that manager_id.
// Otherwise returns the user's own _id (they are the company owner).
const getRootManagerId = async (userId) => {
  const user = await User.findById(userId).select('manager_id').lean();
  if (user && user.manager_id) return user.manager_id;
  return userId.toString();
};

const defaultWorkingHoursDays = () =>
  Array.from({ length: 7 }, () => ({ enabled: false, from: '09:00', to: '17:00' }));

const normalizeWorkingHours = (wh) => {
  const enabled = !!(wh && wh.enabled);
  const rawDays = Array.isArray(wh && wh.days) ? wh.days : [];
  const days = defaultWorkingHoursDays().map((def, i) => {
    const d = rawDays[i] || {};
    return {
      enabled: typeof d.enabled === 'boolean' ? d.enabled : def.enabled,
      from: typeof d.from === 'string' && /^\d{2}:\d{2}$/.test(d.from) ? d.from : def.from,
      to:   typeof d.to   === 'string' && /^\d{2}:\d{2}$/.test(d.to)   ? d.to   : def.to,
    };
  });
  return { enabled, days };
};

const serializeGroup = (g) => ({
  id: g._id.toString(),
  name: g.name,
  openingMessage: g.openingMessage || '',
  closingMessage: g.closingMessage || '',
  unavailableMessage: g.unavailableMessage || '',
  workingHours: normalizeWorkingHours(g.workingHours),
});

// GET /api/rep-groups
export const getRepGroups = async (req, res) => {
  try {
    const rootId = await getRootManagerId(req.userId);
    const groups = await RepGroup.find({ manager_id: rootId }).sort({ createdAt: -1 }).lean();
    res.json(groups.map(serializeGroup));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/rep-groups/:id
export const getRepGroup = async (req, res) => {
  try {
    const rootId = await getRootManagerId(req.userId);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'מזהה לא תקין' });
    }
    const group = await RepGroup.findOne({ _id: id, manager_id: rootId }).lean();
    if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    res.json(serializeGroup(group));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/rep-groups/:id — update settings
export const updateRepGroup = async (req, res) => {
  try {
    const rootId = await getRootManagerId(req.userId);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'מזהה לא תקין' });
    }
    const group = await RepGroup.findOne({ _id: id, manager_id: rootId });
    if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

    const { name, openingMessage, closingMessage, unavailableMessage, workingHours } = req.body || {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: 'שם הקבוצה לא יכול להיות ריק' });
      group.name = trimmed;
    }
    if (openingMessage !== undefined)     group.openingMessage     = String(openingMessage || '');
    if (closingMessage !== undefined)     group.closingMessage     = String(closingMessage || '');
    if (unavailableMessage !== undefined) group.unavailableMessage = String(unavailableMessage || '');
    if (workingHours !== undefined) {
      group.workingHours = normalizeWorkingHours(workingHours);
      group.markModified('workingHours');
    }

    await group.save();
    res.json(serializeGroup(group.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/rep-groups/reps — list all reps (role=rep) belonging to the company,
// each with their rep_group_ids. Used by the bot editor "transfer to agent" node
// to let the user pick a specific rep from the chosen rep group.
export const getRepsForGroups = async (req, res) => {
  try {
    const rootId = await getRootManagerId(req.userId);
    const reps = await User.find({ manager_id: rootId, role: 'rep' })
      .select('name email rep_group_ids')
      .sort({ name: 1 })
      .lean();
    res.json(reps.map(r => ({
      id: r._id.toString(),
      name: r.name,
      email: r.email,
      repGroupIds: (r.rep_group_ids || []).map(id => id.toString())
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/rep-groups
export const createRepGroup = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'שם הקבוצה הוא שדה חובה' });
    }
    const rootId = await getRootManagerId(req.userId);
    const group = await RepGroup.create({ name: name.trim(), manager_id: rootId });
    res.status(201).json(serializeGroup(group.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/rep-groups/:id
export const deleteRepGroup = async (req, res) => {
  try {
    const rootId = await getRootManagerId(req.userId);
    const { id } = req.params;

    const group = await RepGroup.findOne({ _id: id, manager_id: rootId });
    if (!group) {
      return res.status(404).json({ error: 'קבוצה לא נמצאה' });
    }

    await RepGroup.deleteOne({ _id: id });

    // Remove the deleted group from all rep users belonging to this company
    await User.updateMany(
      { manager_id: rootId },
      { $pull: { rep_group_ids: new mongoose.Types.ObjectId(id) } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

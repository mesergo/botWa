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

// GET /api/rep-groups
export const getRepGroups = async (req, res) => {
  try {
    const rootId = await getRootManagerId(req.userId);
    const groups = await RepGroup.find({ manager_id: rootId }).sort({ createdAt: -1 });
    res.json(groups.map(g => ({ id: g._id.toString(), name: g.name })));
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
    res.status(201).json({ id: group._id.toString(), name: group.name });
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

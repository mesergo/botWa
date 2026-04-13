
import StandardProcess from '../models/StandardProcess.js';
import Widget from '../models/Widget.js';

export const createProcess = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;
  try {
    const process = await StandardProcess.create({
      process_name: name,
      user_id: userId
    });
    res.json({ id: process._id.toString(), name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProcesses = async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await StandardProcess.find({ user_id: userId });
    res.json(rows.map(r => ({ id: r._id.toString(), name: r.process_name })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProcessUsage = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    // Count proxy widgets (isStandardProcess:1) that reference this process across all bots
    const count = await Widget.countDocuments({
      standard_process_id: id,
      user_id: userId,
      isStandardProcess: 1,
      flow_id: { $ne: null }
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteProcess = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    // Delete all widgets (content + proxy) for this process across ALL bots
    await Widget.deleteMany({ standard_process_id: id, user_id: userId });
    await StandardProcess.deleteOne({ _id: id, user_id: userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

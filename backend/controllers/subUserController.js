import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../middleware/auth.js';

// GET /api/sub-users — list all reps belonging to the authenticated company manager
export const getSubUsers = async (req, res) => {
  try {
    const managerId = req.userId;
    const reps = await User.find({ manager_id: managerId }).select(
      'name email phone role status createdAt'
    ).sort({ createdAt: -1 });
    res.json(reps.map(r => ({
      id: r._id.toString(),
      name: r.name,
      email: r.email,
      phone: r.phone || '',
      role: r.role,
      status: r.status,
      createdAt: r.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/sub-users — create a new rep under the authenticated company manager
export const createSubUser = async (req, res) => {
  try {
    const managerId = req.userId;
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'שם, אימייל וסיסמה הם שדות חובה' });
    }

    const allowedRoles = ['rep', 'rep_bot'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'סוג משתמש לא תקין. בחר נציג מורשה עריכה (rep_bot) או נציג רגיל (rep).' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' });
    }

    const publicId = Math.random().toString(36).substring(2, 15);
    const rep = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone || '',
      role,
      manager_id: managerId,
      public_id: publicId,
      account_type: '',
      status: 'active',
    });

    res.status(201).json({
      id: rep._id.toString(),
      name: rep.name,
      email: rep.email,
      phone: rep.phone || '',
      role: rep.role,
      status: rep.status,
      createdAt: rep.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/sub-users/:id — update a rep's details
export const updateSubUser = async (req, res) => {
  try {
    const managerId = req.userId;
    const { id } = req.params;
    const { name, email, phone, role, password } = req.body;

    const rep = await User.findOne({ _id: id, manager_id: managerId });
    if (!rep) {
      return res.status(404).json({ error: 'נציג לא נמצא' });
    }

    const allowedRoles = ['rep', 'rep_bot'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'סוג משתמש לא תקין' });
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: rep._id } });
      if (existing) return res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' });
      rep.email = normalizedEmail;
    }
    if (name && name.trim()) rep.name = name.trim();
    if (phone !== undefined) rep.phone = phone;
    if (role) rep.role = role;
    if (password && password.trim()) rep.password = password.trim();

    await rep.save();
    res.json({
      id: rep._id.toString(),
      name: rep.name,
      email: rep.email,
      phone: rep.phone || '',
      role: rep.role,
      status: rep.status,
      createdAt: rep.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/sub-users/:id — delete a rep
export const deleteSubUser = async (req, res) => {
  try {
    const managerId = req.userId;
    const { id } = req.params;

    const rep = await User.findOne({ _id: id, manager_id: managerId });
    if (!rep) {
      return res.status(404).json({ error: 'נציג לא נמצא' });
    }

    await User.deleteOne({ _id: id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

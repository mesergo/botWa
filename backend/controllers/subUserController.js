import mongoose from 'mongoose';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../middleware/auth.js';
import UserType from '../models/UserType.js';
import { resolvePermissions, hasPermission } from '../middleware/auth.js';

// Returns the root company manager ID for the given userId.
// If the user is a sub-user (rep/rep_manager with a manager_id), returns that manager_id.
// Otherwise returns the user's own _id (they are the company owner).
const getRootManagerId = async (userId) => {
  const user = await User.findById(userId).select('manager_id').lean();
  if (user && user.manager_id) return user.manager_id.toString();
  return userId.toString();
};

// GET /api/sub-users — list all reps belonging to the authenticated company manager
export const getSubUsers = async (req, res) => {
  try {
    const managerId = await getRootManagerId(req.userId);
    const actor = await User.findById(req.userId).select('role user_type_id').lean();
    const actorPerms = await resolvePermissions(actor || { role: req.user?.role });

    let availableUserTypes = [];
    if (hasPermission(actorPerms, 'users.add')) {
      const filter = { show_in_users_tab: true };
      if (actor?.role === 'admin') {
        // Admin by role always gets all user types
        availableUserTypes = await UserType.find(filter).select('_id name system_role').sort({ createdAt: 1 }).lean();
      } else {
        // Mirror resolvePermissions: prefer explicit user_type_id, fall back to seeded type by role
        const actorType = actor?.user_type_id
          ? await UserType.findById(actor.user_type_id).lean()
          : actor?.role
            ? await UserType.findOne({ system_role: actor.role, is_seeded: true }).lean()
            : null;
        const canAddByType = !!actorType?.can_add_users;
        const allowedIds = Array.isArray(actorType?.allowed_user_type_ids) ? actorType.allowed_user_type_ids : [];
        if (canAddByType) {
          if (allowedIds.length > 0) {
            availableUserTypes = await UserType.find({ _id: { $in: allowedIds }, show_in_users_tab: true })
              .select('_id name system_role')
              .sort({ createdAt: 1 })
              .lean();
          } else {
            availableUserTypes = await UserType.find(filter).select('_id name system_role').sort({ createdAt: 1 }).lean();
          }
        }
      }
    }

    const reps = await User.find({ manager_id: managerId }).select(
      'name email phone role status availability_status createdAt rep_group_ids user_type_id'
    ).sort({ createdAt: -1 });
    res.json({
      users: reps.map(r => ({
      id: r._id.toString(),
      name: r.name,
      email: r.email,
      phone: r.phone || '',
      role: r.role,
      status: r.status,
      availability_status: r.availability_status || 'unavailable',
      createdAt: r.createdAt,
      user_type_id: r.user_type_id || null,
      repGroupIds: (r.rep_group_ids || []).map(id => id.toString()),
      })),
      availableUserTypes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/sub-users — create a new rep under the authenticated company manager
export const createSubUser = async (req, res) => {
  try {
    const managerId = await getRootManagerId(req.userId);
    const { name, email, password, phone, role, rep_group_ids, user_type_id } = req.body;

    const actor = await User.findById(req.userId).select('role user_type_id').lean();
    const actorPerms = await resolvePermissions(actor || { role: req.user?.role });
    if (!hasPermission(actorPerms, 'users.add')) {
      return res.status(403).json({ error: 'אין הרשאה להוספת משתמשים' });
    }

    const actorType = actor?.user_type_id
      ? await UserType.findById(actor.user_type_id).lean()
      : actor?.role
        ? await UserType.findOne({ system_role: actor.role, is_seeded: true }).lean()
        : null;
    const canAddByType = !!actorType?.can_add_users;
    if (!canAddByType && actor?.role !== 'admin' && actor?.role !== 'user') {
      return res.status(403).json({ error: 'סוג המשתמש שלך אינו מורשה להוסיף משתמשים' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'שם, אימייל וסיסמה הם שדות חובה' });
    }

    if (!user_type_id) {
      return res.status(400).json({ error: 'יש לבחור סוג משתמש' });
    }

    const targetType = await UserType.findById(user_type_id).lean();
    if (!targetType) {
      return res.status(400).json({ error: 'סוג משתמש לא תקין' });
    }
    if (!targetType.show_in_users_tab) {
      return res.status(400).json({ error: 'סוג משתמש זה אינו זמין להוספה דרך לשונית משתמשים' });
    }

    const actorAllowedIds = Array.isArray(actorType?.allowed_user_type_ids)
      ? actorType.allowed_user_type_ids.map(id => id.toString())
      : [];
    if (actor?.role !== 'admin' && actorAllowedIds.length > 0 && !actorAllowedIds.includes(targetType._id.toString())) {
      return res.status(403).json({ error: 'אין הרשאה להוסיף משתמש מהסוג שנבחר' });
    }

    const effectiveRole = targetType.system_role || role;
    const allowedRoles = ['rep', 'rep_manager', 'user'];
    if (!allowedRoles.includes(effectiveRole)) {
      return res.status(400).json({ error: 'סוג המשתמש שנבחר אינו נתמך להוספה במסך זה' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' });
    }

    const publicId = Math.random().toString(36).substring(2, 15);
    const repData = {
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone || '',
      role: effectiveRole,
      user_type_id: targetType._id,
      manager_id: managerId,
      public_id: publicId,
      account_type: '',
      status: 'active',
    };
    if (effectiveRole === 'rep' && Array.isArray(rep_group_ids) && rep_group_ids.length > 0) {
      repData.rep_group_ids = rep_group_ids.map(id => new mongoose.Types.ObjectId(id));
    }
    const rep = await User.create(repData);

    res.status(201).json({
      id: rep._id.toString(),
      name: rep.name,
      email: rep.email,
      phone: rep.phone || '',
      role: rep.role,
      status: rep.status,
      createdAt: rep.createdAt,
      user_type_id: rep.user_type_id || null,
      repGroupIds: (rep.rep_group_ids || []).map(id => id.toString()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/sub-users/:id — update a rep's details
export const updateSubUser = async (req, res) => {
  try {
    const managerId = await getRootManagerId(req.userId);
    const { id } = req.params;
    const { name, email, phone, role, password, rep_group_ids } = req.body;

    const rep = await User.findOne({ _id: id, manager_id: managerId });
    if (!rep) {
      return res.status(404).json({ error: 'נציג לא נמצא' });
    }

    const allowedRoles = ['rep', 'rep_manager'];
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
    // rep_group_ids: rep_managers always get []; reps get the provided array if sent
    if (rep.role === 'rep_manager') {
      rep.rep_group_ids = [];
    } else if (rep.role === 'rep' && rep_group_ids !== undefined) {
      rep.rep_group_ids = Array.isArray(rep_group_ids)
        ? rep_group_ids.map(id => new mongoose.Types.ObjectId(id))
        : [];
    }

    await rep.save();
    res.json({
      id: rep._id.toString(),
      name: rep.name,
      email: rep.email,
      phone: rep.phone || '',
      role: rep.role,
      status: rep.status,
      createdAt: rep.createdAt,
      repGroupIds: (rep.rep_group_ids || []).map(id => id.toString()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/sub-users/:id — delete a rep
export const deleteSubUser = async (req, res) => {
  try {
    const managerId = await getRootManagerId(req.userId);
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

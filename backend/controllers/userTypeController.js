import UserType from '../models/UserType.js';

// GET /api/admin/user-types
export const listUserTypes = async (req, res) => {
  try {
    const types = await UserType.find({})
      .populate('allowed_user_type_ids', 'name system_role')
      .sort({ createdAt: 1 });
    res.json({ userTypes: types });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/user-types
export const createUserType = async (req, res) => {
  try {
    const { name, can_add_users, permissions, show_in_users_tab, allowed_user_type_ids } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'שם סוג המשתמש נדרש' });
    }
    const normalizedAllowed = Array.isArray(allowed_user_type_ids) ? allowed_user_type_ids : [];
    const userType = await UserType.create({
      name: name.trim(),
      can_add_users: !!can_add_users,
      show_in_users_tab: show_in_users_tab !== false,
      allowed_user_type_ids: normalizedAllowed,
      permissions: permissions || {},
      is_seeded: false
    });
    const created = await UserType.findById(userType._id).populate('allowed_user_type_ids', 'name system_role');
    res.status(201).json({ userType: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/admin/user-types/:id
export const updateUserType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, can_add_users, permissions, show_in_users_tab, allowed_user_type_ids } = req.body;

    const userType = await UserType.findById(id);
    if (!userType) return res.status(404).json({ error: 'סוג משתמש לא נמצא' });

    // Seeded types cannot be renamed (but permissions can change)
    if (!userType.is_seeded && name && name.trim()) {
      userType.name = name.trim();
    }
    if (can_add_users !== undefined) userType.can_add_users = !!can_add_users;
    if (show_in_users_tab !== undefined) userType.show_in_users_tab = !!show_in_users_tab;
    if (allowed_user_type_ids !== undefined) {
      userType.allowed_user_type_ids = Array.isArray(allowed_user_type_ids) ? allowed_user_type_ids : [];
    }
    if (permissions) userType.permissions = permissions;

    await userType.save();
    const updated = await UserType.findById(userType._id).populate('allowed_user_type_ids', 'name system_role');
    res.json({ userType: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/user-types/:id
export const deleteUserType = async (req, res) => {
  try {
    const { id } = req.params;
    const userType = await UserType.findById(id);
    if (!userType) return res.status(404).json({ error: 'סוג משתמש לא נמצא' });
    if (userType.is_seeded) {
      return res.status(400).json({ error: 'לא ניתן למחוק סוג משתמש מובנה' });
    }
    await UserType.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

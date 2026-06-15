/**
 * Seed built-in user types into UserType collection.
 * Run once: node backend/scripts/seed-user-types.js
 * Or called automatically from server.js on startup (idempotent).
 */
import UserType from '../models/UserType.js';

const SEEDED_TYPES = [
  {
    name: 'מנהל מערכת',
    system_role: 'admin',
    is_seeded: true,
    can_add_users: true,
    show_in_users_tab: false,
    permissions: {
      bots:     { view_tab: true, create: true, edit: true, delete: true, settings: true, publish: true },
      sessions: { view: true, add: true, view_all: true, view_assigned_only: true, templates_as_rep: true, templates_as_manager: true },
      contacts: { view: true, add: true, edit: true, delete: true, import_excel: true },
      groups:   { view: true, create: true, add_contact: true, send_message: true, remove_contact: true },
      settings: { view: true, edit_profile: true },
      users:    { view: true, add: true, edit: true, delete: true },
      rep_groups: { view: true, add: true, delete: true }
    }
  },
  {
    name: 'משתמש',
    system_role: 'user',
    is_seeded: true,
    can_add_users: true,
    show_in_users_tab: true,
    permissions: {
      bots:     { view_tab: true, create: true, edit: true, delete: true, settings: true, publish: true },
      sessions: { view: true, add: true, view_all: true, view_assigned_only: false, templates_as_rep: false, templates_as_manager: true },
      contacts: { view: true, add: true, edit: true, delete: true, import_excel: true },
      groups:   { view: true, create: true, add_contact: true, send_message: true, remove_contact: true },
      settings: { view: true, edit_profile: true },
      users:    { view: true, add: true, edit: true, delete: true },
      rep_groups: { view: true, add: true, delete: true }
    }
  },
  {
    name: 'מנהל משמרת',
    system_role: 'rep_manager',
    is_seeded: true,
    can_add_users: false,
    show_in_users_tab: true,
    permissions: {
      bots:     { view_tab: false, create: false, edit: false, delete: false, settings: false, publish: false },
      sessions: { view: true, add: true, view_all: true, view_assigned_only: false, templates_as_rep: false, templates_as_manager: true },
      contacts: { view: true, add: true, edit: true, delete: false, import_excel: false },
      groups:   { view: true, create: false, add_contact: false, send_message: true, remove_contact: false },
      settings: { view: true, edit_profile: true },
      users:    { view: false, add: false, edit: false, delete: false },
      rep_groups: { view: false, add: false, delete: false }
    }
  },
  {
    name: 'נציג',
    system_role: 'rep',
    is_seeded: true,
    can_add_users: false,
    show_in_users_tab: true,
    permissions: {
      bots:     { view_tab: false, create: false, edit: false, delete: false, settings: false, publish: false },
      sessions: { view: true, add: false, view_all: false, view_assigned_only: true, templates_as_rep: true, templates_as_manager: false },
      contacts: { view: true, add: false, edit: false, delete: false, import_excel: false },
      groups:   { view: true, create: false, add_contact: false, send_message: false, remove_contact: false },
      settings: { view: true, edit_profile: true },
      users:    { view: false, add: false, edit: false, delete: false },
      rep_groups: { view: false, add: false, delete: false }
    }
  }
];

export const seedUserTypes = async () => {
  for (const typeData of SEEDED_TYPES) {
    const existing = await UserType.findOne({ system_role: typeData.system_role, is_seeded: true });
    if (!existing) {
      await UserType.create(typeData);
      console.log(`✅ Seeded user type: ${typeData.name}`);
    }
  }

  // Keep seeded allow-list defaults in sync (idempotent)
  const seeded = await UserType.find({ is_seeded: true }).select('_id system_role').lean();
  const byRole = Object.fromEntries(seeded.map(t => [t.system_role, t._id]));

  if (byRole.user) {
    const allowed = [byRole.rep_manager, byRole.rep].filter(Boolean);
    await UserType.updateOne({ _id: byRole.user }, { $set: { allowed_user_type_ids: allowed } });
  }
  if (byRole.admin) {
    const all = Object.values(byRole).filter(Boolean);
    await UserType.updateOne({ _id: byRole.admin }, { $set: { allowed_user_type_ids: all } });
  }
  if (byRole.rep_manager) {
    await UserType.updateOne({ _id: byRole.rep_manager }, { $set: { allowed_user_type_ids: [] } });
  }
  if (byRole.rep) {
    await UserType.updateOne({ _id: byRole.rep }, { $set: { allowed_user_type_ids: [] } });
  }
};

export default seedUserTypes;

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
      rep_groups: { view: true, add: true, delete: true },
      sms_in:   { view: true }
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
      rep_groups: { view: true, add: true, delete: true },
      sms_in:   { view: true }
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
      rep_groups: { view: false, add: false, delete: false },
      sms_in:   { view: false }
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
      rep_groups: { view: false, add: false, delete: false },
      sms_in:   { view: false }
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

  // Set allowed_user_type_ids defaults ONLY on first-time creation (never overwrite admin changes).
  const seeded = await UserType.find({ is_seeded: true }).select('_id system_role allowed_user_type_ids').lean();
  const byRole = Object.fromEntries(seeded.map(t => [t.system_role, t]));

  if (byRole.user && (!byRole.user.allowed_user_type_ids || byRole.user.allowed_user_type_ids.length === 0)) {
    const allowed = [byRole.rep_manager?._id, byRole.rep?._id].filter(Boolean);
    await UserType.updateOne({ _id: byRole.user._id }, { $set: { allowed_user_type_ids: allowed } });
  }
  if (byRole.admin && (!byRole.admin.allowed_user_type_ids || byRole.admin.allowed_user_type_ids.length === 0)) {
    const all = seeded.map(t => t._id);
    await UserType.updateOne({ _id: byRole.admin._id }, { $set: { allowed_user_type_ids: all } });
  }

  // Ensure sms_in permission exists on seeded types (idempotent patch for existing DBs)
  await UserType.updateOne(
    { system_role: 'admin', is_seeded: true },
    { $set: { 'permissions.sms_in': { view: true } } }
  );
  await UserType.updateOne(
    { system_role: 'user', is_seeded: true },
    { $set: { 'permissions.sms_in': { view: true } } }
  );
  await UserType.updateMany(
    { system_role: { $in: ['rep_manager', 'rep'] }, is_seeded: true },
    { $set: { 'permissions.sms_in': { view: false } } }
  );

  // Idempotent patch for existing DBs: the admin user type must never be selectable from
  // the Sub-Users tab. Older documents created before `show_in_users_tab` existed on this
  // type fell back to the schema default (true), incorrectly exposing "מנהל מערכת" there.
  await UserType.updateOne(
    { system_role: 'admin', is_seeded: true },
    { $set: { show_in_users_tab: false } }
  );
};

export default seedUserTypes;

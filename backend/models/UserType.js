import mongoose from 'mongoose';

const permissionsSchema = new mongoose.Schema({
  bots: {
    view_tab:   { type: Boolean, default: false },
    create:     { type: Boolean, default: false },
    edit:       { type: Boolean, default: false },
    delete:     { type: Boolean, default: false },
    settings:   { type: Boolean, default: false },
    publish:    { type: Boolean, default: false }
  },
  sessions: {
    view:                   { type: Boolean, default: false },
    add:                    { type: Boolean, default: false },
    view_all:               { type: Boolean, default: false },
    view_assigned_only:     { type: Boolean, default: false },
    templates_as_rep:       { type: Boolean, default: false },
    templates_as_manager:   { type: Boolean, default: false }
  },
  contacts: {
    view:         { type: Boolean, default: false },
    add:          { type: Boolean, default: false },
    edit:         { type: Boolean, default: false },
    delete:       { type: Boolean, default: false },
    import_excel: { type: Boolean, default: false }
  },
  groups: {
    view:           { type: Boolean, default: false },
    create:         { type: Boolean, default: false },
    add_contact:    { type: Boolean, default: false },
    send_message:   { type: Boolean, default: false },
    remove_contact: { type: Boolean, default: false }
  },
  settings: {
    view:         { type: Boolean, default: false },
    edit_profile: { type: Boolean, default: false }
  },
  users: {
    view:   { type: Boolean, default: false },
    add:    { type: Boolean, default: false },
    edit:   { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  },
  rep_groups: {
    view:   { type: Boolean, default: false },
    add:    { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  }
}, { _id: false });

const userTypeSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  // Maps to legacy role string for backward-compat (admin | user | rep_manager | rep | null)
  system_role:   { type: String, default: null },
  // Seeded types are created on install and cannot be deleted (but permissions can be changed)
  is_seeded:     { type: Boolean, default: false },
  // Whether users of this type can create new users themselves
  can_add_users: { type: Boolean, default: false },
  // Whether this type appears in Users tab when creating a sub-user
  show_in_users_tab: { type: Boolean, default: true },
  // Optional whitelist of user types this type may create from Users tab
  allowed_user_type_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserType', default: [] }],
  permissions:   { type: permissionsSchema, default: () => ({}) }
}, {
  timestamps: true,
  collection: 'UserType'
});

export default mongoose.model('UserType', userTypeSchema);

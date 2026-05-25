import mongoose from 'mongoose';

/**
 * Group model – manages user-defined contact groups (mailing lists).
 *
 * Two kinds of records per user:
 *  - Regular groups: { is_blocklist: false, name, contact_ids: [...] }
 *  - The single fixed blocklist: { is_blocklist: true, name: 'רשימת הסרה', phones: [...] }
 *
 * A phone in the blocklist is excluded from ALL broadcasts even if it belongs to other groups.
 */
const groupSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    is_blocklist: { type: Boolean, default: false, index: true },
    // Members for regular groups (refs to Contact._id)
    contact_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact', default: [] }],
    // For the blocklist we also store raw phone strings so that a phone can be blocked
    // even before it exists as a contact record.
    phones: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'Group' }
);

// One blocklist per user; allow multiple groups by name as long as unique per user
groupSchema.index(
  { user_id: 1, is_blocklist: 1 },
  { unique: true, partialFilterExpression: { is_blocklist: true } }
);
groupSchema.index({ user_id: 1, name: 1 });

export default mongoose.model('Group', groupSchema);

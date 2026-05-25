import mongoose from 'mongoose';

/**
 * GroupRemovalLog – records every removal of a contact from a group.
 * Preserves contact snapshot fields so the report stays readable even
 * if the contact record is later edited or deleted.
 */
const groupRemovalLogSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    group_name: { type: String, default: '' },
    is_blocklist: { type: Boolean, default: false },
    contact_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', default: null },
    phone: { type: String, default: '' },
    full_name: { type: String, default: '' },
    whatsapp_name: { type: String, default: '' },
    email: { type: String, default: '' },
    reason: { type: String, default: '' },
    removed_by: { type: String, default: '' },
  },
  { timestamps: true, collection: 'GroupRemovalLog' }
);

groupRemovalLogSchema.index({ user_id: 1, createdAt: -1 });

export default mongoose.model('GroupRemovalLog', groupRemovalLogSchema);

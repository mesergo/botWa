import mongoose from 'mongoose';
import { normalizePhone } from '../utils/phone.js';

const contactSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  phone: { type: String, required: true },
  full_name: { type: String, default: '' },
  whatsapp_name: { type: String, default: '' },
  email: { type: String, default: '' },
  // Flexible key-value store for future custom fields defined by the company manager
  custom_field_values: { type: mongoose.Schema.Types.Mixed, default: {} },
  assigned_to: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Group-broadcast messages sent to this contact before any BotSession existed.
  // Drained into the new session's process_history as soon as one is created (see chatController.js).
  pending_history: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, {
  timestamps: true,
  collection: 'Contact'
});
 
// Unique: one contact record per phone per user
contactSchema.index({ user_id: 1, phone: 1 }, { unique: true });

// Normalize phone to 972XXXXXXXXX format before saving
contactSchema.pre('validate', function (next) {
  if (this.phone) {
    this.phone = normalizePhone(this.phone);
  }
  next();
});

export default mongoose.model('Contact', contactSchema);

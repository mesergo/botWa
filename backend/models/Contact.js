import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  phone: { type: String, required: true },
  full_name: { type: String, default: '' },
  whatsapp_name: { type: String, default: '' },
  email: { type: String, default: '' },
  // Flexible key-value store for future custom fields defined by the company manager
  custom_field_values: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
  collection: 'Contact'
});

// Unique: one contact record per phone per user
contactSchema.index({ user_id: 1, phone: 1 }, { unique: true });

export default mongoose.model('Contact', contactSchema);

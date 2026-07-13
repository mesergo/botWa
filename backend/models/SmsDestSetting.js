import mongoose from 'mongoose';

const smsDestSettingSchema = new mongoose.Schema(
  {
    dest: { type: String, required: true, unique: true, trim: true },
    assignedClientId: { type: String, default: null, index: true },
    assignedClientName: { type: String, default: '' },
    googleSheetsUrl: { type: String, default: '' },
    webhookUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'sms_dest_settings',
  }
);

export default mongoose.model('SmsDestSetting', smsDestSettingSchema);

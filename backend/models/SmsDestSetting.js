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
    // Set by the /reg onboarding wizard when a new customer picks this line
    // (request-number in whatsappRegistrationController.js) — NOT an assignment,
    // just a marker so the "שיוך קווים" admin tab can show "בהמתנה לשיוך" with the
    // customer's name until a rep manually completes the real assignment.
    pendingCustomerName: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'sms_dest_settings',
  }
);

export default mongoose.model('SmsDestSetting', smsDestSettingSchema);

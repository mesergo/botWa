import mongoose from 'mongoose';

// Local copy of incoming SMS reported by the external "maskyoo" endpoint.
// Kept separate from the sms-in module, which reads/writes the external ilbot
// MongoDB (SMS_MONGODB_URI) — this collection lives in our own MongoDB.
const smsExternalLogSchema = new mongoose.Schema(
  {
    appName: { type: String, default: '' },
    dest: { type: String, required: true },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    date: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'sms',
  }
);

export default mongoose.model('SmsExternalLog', smsExternalLogSchema);

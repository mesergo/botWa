import mongoose from 'mongoose';

/**
 * Log of notification emails sent to a user (offline alerts, daily summaries).
 * Kept separate from `Notification` so it never shows up in the in-app bell;
 * the daily summary reads it to list the offline alerts sent that day.
 */
const emailAlertLogSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  kind: { type: String, enum: ['offline', 'daily_summary'], required: true },
  session_id: { type: String, default: null },
  customer_phone: { type: String, default: '' },
  customer_name: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'EmailAlertLog'
});

emailAlertLogSchema.index({ user_id: 1, createdAt: -1 });

export default mongoose.model('EmailAlertLog', emailAlertLogSchema);

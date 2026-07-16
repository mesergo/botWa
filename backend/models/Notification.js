import mongoose from 'mongoose';

/**
 * Persistent notification for a user — created when a conversation is
 * transferred to them (or to a group they belong to).
 * Survives across disconnections so the user sees the alert on next login.
 */
const notificationSchema = new mongoose.Schema({
  // The user who should receive this notification
  user_id: { type: String, required: true, index: true },

  // The session that was transferred
  session_id: { type: String, required: true },
  session_phone: { type: String, default: '' },

  // Who triggered the transfer ("Bot" for automatic transfers)
  from_user_name: { type: String, default: '' },

  // Human-readable label of the transfer destination
  target_label: { type: String, default: '' },

  // Whether the session is a simulator session (no real WhatsApp phone)
  is_simulator: { type: Boolean, default: false },

  // Whether the user has dismissed this notification
  dismissed: { type: Boolean, default: false, index: true },

  // Whether the customer requested a phone callback when the conversation was transferred
  wants_phone: { type: Boolean, default: false },
}, {
  timestamps: true,
  collection: 'Notification'
});

export default mongoose.model('Notification', notificationSchema);

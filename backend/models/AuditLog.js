import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'LOGIN', 'DELETE_BOT', 'IMPERSONATE'
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who did it
  actor_email: String, // Snapshot of email in case user is deleted
  target_id: String, // ID of the affected object (user_id, bot_id, etc.)
  target_type: String, // 'User', 'Bot', 'Process'
  details: mongoose.Schema.Types.Mixed,
  ip_address: String
}, {
  timestamps: true,
  collection: 'AuditLog'
});

export default mongoose.model('AuditLog', auditLogSchema);

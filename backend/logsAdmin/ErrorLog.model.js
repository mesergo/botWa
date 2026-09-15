import mongoose from 'mongoose';

// Persistent record of every error a platform client hits — either a tenant
// (a User managed under "ניהול לקוחות") hitting an error in the admin/UI
// interface, or an end WhatsApp customer of a tenant's bot hitting a failure
// during the bot conversation flow. Populated by backend/logsAdmin/errorLogger.js,
// which is called from a small number of explicit instrumentation points plus a
// global Express response interceptor — see backend/logsAdmin/responseErrorInterceptor.js.
const errorLogSchema = new mongoose.Schema({
  seq: { type: Number, unique: true, index: true },
  category: {
    type: String,
    enum: ['auth', 'whatsapp_send', 'webhook', 'api', 'client_ui', 'network', 'internal'],
    required: true,
    index: true,
  },
  source: String, // e.g. "POST /api/admin/users" or "whatsappSender.sendOne"
  message_he: String,
  message_en: String,
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  client_name: String, // denormalized snapshot of the client's account name, nullable
  end_customer_phone: String, // nullable — set for whatsapp_send/webhook errors
  status_code: Number,
  stack: String,
  details: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
  collection: 'ErrorLog',
});

errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ category: 1, createdAt: -1 });
errorLogSchema.index({ client_id: 1, createdAt: -1 });

export default mongoose.model('ErrorLog', errorLogSchema);

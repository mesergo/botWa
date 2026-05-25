import mongoose from 'mongoose';

const groupBroadcastSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  group_name: { type: String, default: '' },

  // What was sent
  is_template: { type: Boolean, default: false },
  message: { type: String, default: '' },              // text-mode body
  template_name: { type: String, default: '' },        // template-mode name
  template_language: { type: String, default: '' },
  template_data: { type: mongoose.Schema.Types.Mixed }, // full templateData snapshot

  // Results
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
  total: { type: Number, default: 0 },
  processed: { type: Number, default: 0 }, // total processed so far (for progress)
  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  errors: { type: Array, default: [] }, // [{phone, status, error}]
  recipients: { type: Array, default: [] }, // [{phone, name, status: 'sent'|'failed'|'skipped'}]
  started_at: { type: Date },
  completed_at: { type: Date },

  sent_by: { type: String, default: '' }, // user email/name who triggered
}, {
  timestamps: true,
  collection: 'group_broadcasts',
});

groupBroadcastSchema.index({ user_id: 1, createdAt: -1 });
groupBroadcastSchema.index({ group_id: 1, createdAt: -1 });

export default mongoose.model('GroupBroadcast', groupBroadcastSchema);

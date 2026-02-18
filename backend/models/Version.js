import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user_id: { type: String, required: true },
  flow_id: String,
  standard_process_id: String,
  isLocked: { type: Boolean, default: false },
  data: mongoose.Schema.Types.Mixed,
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'versions'
});

export default mongoose.model('Version', versionSchema);

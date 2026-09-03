import mongoose from 'mongoose';

const internalDataSyncLogSchema = new mongoose.Schema({
  table_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalDataTable', required: true, index: true },
  user_id: { type: String, required: true, index: true },
  trigger: { type: String, enum: ['manual', 'scheduled', 'initial_upload'], required: true },
  status: { type: String, enum: ['success', 'failed'], required: true },
  records_processed: { type: Number, default: 0 },
  records_added: { type: Number, default: 0 },
  records_updated: { type: Number, default: 0 },
  records_deleted: { type: Number, default: 0 },
  duration_ms: { type: Number, default: 0 },
  message: { type: String, default: '' },
  error_details: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'InternalDataSyncLog',
});

internalDataSyncLogSchema.index({ table_id: 1, createdAt: -1 });

export default mongoose.model('InternalDataSyncLog', internalDataSyncLogSchema);

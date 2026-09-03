import mongoose from 'mongoose';

const internalDataRowSchema = new mongoose.Schema({
  table_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalDataTable', required: true, index: true },
  user_id: { type: String, required: true, index: true },
  values: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
  collection: 'InternalDataRow',
});

internalDataRowSchema.index({ table_id: 1, createdAt: -1 });

export default mongoose.model('InternalDataRow', internalDataRowSchema);

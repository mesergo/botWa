import mongoose from 'mongoose';

const edgeSchema = new mongoose.Schema({
  id: String,
  source: String,
  target: String,
  sourceHandle: String,
  type: String,
  style: mongoose.Schema.Types.Mixed,
  markerEnd: mongoose.Schema.Types.Mixed,
  user_id: String,
  standard_process_id: String
}, {
  timestamps: true,
  collection: 'edges'
});

export default mongoose.model('Edge', edgeSchema);

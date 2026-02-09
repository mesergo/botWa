import mongoose from 'mongoose';

const standardProcessSchema = new mongoose.Schema({
  process_name: { type: String, required: true },
  user_id: { type: String, required: true }
}, {
  timestamps: true,
  collection: 'standard_processes'
});

export default mongoose.model('StandardProcess', standardProcessSchema);

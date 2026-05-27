import mongoose from 'mongoose';

const repGroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  manager_id: { type: String, required: true },
}, {
  timestamps: true,
  collection: 'RepGroup',
});

export default mongoose.model('RepGroup', repGroupSchema);

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  public_id: String,
  account_type: { type: String, default: 'Basic' },
  status: { type: String, default: 'active' }
}, {
  timestamps: true,
  collection: 'User'
});

export default mongoose.model('User', userSchema);

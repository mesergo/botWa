import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  password: { type: String, required: true },
    token: { type: String, unique: true, sparse: true },
  role: { type: String, default: 'user' },
  public_id: String,
  account_type: { type: String, default: 'Basic' },
  status: { type: String, default: 'active' },
  custom_limits: {
    max_bots: { type: Number, default: null },
    max_versions: { type: Number, default: null },
    version_price: { type: Number, default: null },
    bot_price: { type: Number, default: null }
  },
  trial_expires_at: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'User'
});

export default mongoose.model('User', userSchema);

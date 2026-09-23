import mongoose from 'mongoose';

// Named, revocable API tokens a client can generate for external integrations
// (in addition to the single legacy User.token). Each has an optional expiry.
const apiTokenSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  token: { type: String, required: true, unique: true },
  expires_at: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'ApiToken'
});

export default mongoose.model('ApiToken', apiTokenSchema);

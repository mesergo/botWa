import mongoose from 'mongoose';

// Named, revocable API tokens a client can generate for external integrations
// (in addition to the single legacy User.token). Each has an optional expiry.
const apiTokenSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  token: { type: String, required: true, unique: true },
  expires_at: { type: Date, default: null },
  // The user who actually created the token (a rep / sub-user, or the owner).
  // The token authenticates as this user, so it carries their role, not the owner's.
  // null on legacy tokens → treated as created by the owner (user_id).
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  last_used_at: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'ApiToken'
});

export default mongoose.model('ApiToken', apiTokenSchema);

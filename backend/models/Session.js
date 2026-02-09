import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true },
  user_id: String,
  variables: mongoose.Schema.Types.Mixed,
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'sessions'
});

export default mongoose.model('Session', sessionSchema);

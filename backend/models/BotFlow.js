import mongoose from 'mongoose';

const botFlowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user_id: { type: String, required: true },
  public_id: String,
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'bot_flows'
});

export default mongoose.model('BotFlow', botFlowSchema);

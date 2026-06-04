import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  password: { type: String, required: false },
  googleId: { type: String, sparse: true },
  token: { type: String, unique: true, sparse: true },
  role: { type: String, default: 'user' },
  public_id: String,
  account_type: { type: String, default: 'Basic' },
  status: { type: String, default: 'active' },
  manager_id: { type: String, default: null },
  dialog360_bot_id: { type: String, default: '' },
  // WhatsApp numbers connected to this account but not yet (or already) assigned to a bot.
  // Populated by Stage 3 (link-number) of the Facebook registration flow.
  connected_numbers: {
    type: [{
      phone_number_id: { type: String, required: true },
      waba_id: { type: String, default: '' },
      display_phone_number: { type: String, default: '' },
      verified_name: { type: String, default: '' },
      quality_rating: { type: String, default: '' },
      whatsapp_status: { type: String, default: '' },
      access_token: { type: String, default: '' },
      registered: { type: Boolean, default: false },
      pin: { type: String, default: '' },
      assigned_bot_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BotFlow', default: null },
      connected_at: { type: Date, default: Date.now }
    }],
    default: []
  },
  custom_limits: {
    max_bots: { type: Number, default: null },
    max_versions: { type: Number, default: null },
    version_price: { type: Number, default: null },
    bot_price: { type: Number, default: null }
  },
  trial_expires_at: { type: Date, default: null },
  rep_group_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RepGroup', default: [] }],
}, { 
  timestamps: true,
  collection: 'User'
});

export default mongoose.model('User', userSchema);

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
  // Availability status for reps/rep_managers: available | unavailable | on_break
  availability_status: { type: String, enum: ['available', 'unavailable', 'on_break'], default: 'unavailable' },
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
      connected_at: { type: Date, default: Date.now },
      // Provider: 'facebook' (default) or 'dialog360'
      provider: { type: String, default: 'facebook' },
      // Dialog360-specific fields
      token360: { type: String, default: '' },
      link: { type: String, default: '' }
    }],
    default: []
  },
  custom_limits: {
    max_bots: { type: Number, default: null },
    max_versions: { type: Number, default: null },
    version_price: { type: Number, default: null },
    bot_price: { type: Number, default: null },
    max_connected_numbers: { type: Number, default: null }
  },
  trial_expires_at: { type: Date, default: null },
  rep_group_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RepGroup', default: [] }],
  // Bot restriction for reps: when non-empty, this rep can only see sessions of these bots.
  // Empty array = no restriction (sees all bots of the account).
  allowed_bot_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotFlow', default: [] }],
  // Per-user override for the auto-removal-from-group feature.
  // When `customized=true`, these values override the global SystemSetting('removal_config').
  // Keywords and messages are split by language: Hebrew (he) and English (en).
  removal_config: {
    customized: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    keywords_he: { type: [String], default: [] },
    message_he: { type: String, default: '' },
    keywords_en: { type: [String], default: [] },
    message_en: { type: String, default: '' }
  },
  user_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserType', default: null },
  // Per-client toggle (set by admin): show the "SMS נכנס" tab. Admins always see it.
  sms_in_enabled: { type: Boolean, default: false },
}, { 
  timestamps: true,
  collection: 'User'
});

export default mongoose.model('User', userSchema);

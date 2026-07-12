import mongoose from 'mongoose';

const botFlowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user_id: { type: String, required: true },
  public_id: String,
  is_default: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  // Parameters filled by the user when creating a bot from a template
  botParams: { type: Map, of: String, default: {} },
  // ── WhatsApp Business / Meta Embedded Signup data ──
  waba_id: { type: String, default: '' },
  phone_number_id: { type: String, default: '' },
  display_phone_number: { type: String, default: '' },
  whatsapp_verified_name: { type: String, default: '' },
  whatsapp_access_token: { type: String, default: '' },
  whatsapp_quality_rating: { type: String, default: '' },
  whatsapp_status: { type: String, default: '' },
  whatsapp_code_verification_status: { type: String, default: '' },
  whatsapp_name_status: { type: String, default: '' },
  whatsapp_messaging_limit_tier: { type: String, default: '' },
  whatsapp_all_phones: { type: Array, default: [] },
  whatsapp_two_factor_pin: { type: String, default: '' },
  whatsapp_registered: { type: Boolean, default: false },
  whatsapp_register_response: { type: mongoose.Schema.Types.Mixed, default: null },
  whatsapp_connected_at: { type: Date, default: null },
  endpoint: { type: String, default: '' },
  restart_keyword: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'bot_flows'
});

export default mongoose.model('BotFlow', botFlowSchema);

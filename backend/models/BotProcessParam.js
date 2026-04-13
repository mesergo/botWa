import mongoose from 'mongoose';

// Stores the per-bot parameter values that a user fills in when they use a
// standard process (fixed script) that has custom form_fields defined.
const botProcessParamSchema = new mongoose.Schema({
  flow_id: { type: String, required: true },
  standard_process_id: { type: String, required: true },
  // Free-form key/value map: { comp_name: "Acme Corp", comp_phone: "050-1234567" }
  params: { type: Map, of: String, default: {} }
}, {
  timestamps: true,
  collection: 'bot_process_params'
});

// Compound unique index: one param-set per bot+process combination
botProcessParamSchema.index({ flow_id: 1, standard_process_id: 1 }, { unique: true });

export default mongoose.model('BotProcessParam', botProcessParamSchema);

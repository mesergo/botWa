import mongoose from 'mongoose';

const botSessionSchema = new mongoose.Schema({
  user_id: String,
  flow_id: String,
  customer_phone: String,
  sender: String,
  widget_id: String,
  simulator_id: String, // Unique identifier for the simulator instance
  current_node_id: String,
  is_active: { type: Boolean, default: true },
  waiting_text_input: { type: Boolean, default: false },
  waiting_webservice: { type: Boolean, default: false },
  last_user_input: String,
  parameters: mongoose.Schema.Types.Mixed,
  process_history: [mongoose.Schema.Types.Mixed],
  execution_stack: [mongoose.Schema.Types.Mixed],
  is_agent: { type: Boolean, default: false },
  agent_since: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'BotSession'
});

export default mongoose.model('BotSession', botSessionSchema);

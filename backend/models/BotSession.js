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
  agent_since: { type: Date, default: null },
  rep_group_id: { type: String, default: null },
  rep_user_id: { type: String, default: null },
  // Snapshot of the rep-waiting context saved when the case2_waiting_30m system
  // trigger auto-transitions a session from rep-waiting mode into an interactive
  // bot step (menu/input). Restored by the "extend_30m" rep-component action.
  bot_override: {
    active: { type: Boolean, default: false },
    reason: { type: String, default: null },
    started_at: { type: Date, default: null },
    prev_rep_group_id: { type: String, default: null },
    prev_rep_user_id: { type: String, default: null },
    prev_status: { type: String, default: null }
  },
  // Conversation status:
  //   'bot'      — default; bot handles the conversation
  //   'waiting'  — transferred to a representative, waiting for response
  //   'handling' — a representative has replied with a free-text message
  //   'closed'   — representative marked the conversation as ended
  status: { type: String, enum: ['bot', 'waiting', 'handling', 'closed', 'resolved'], default: 'bot' },
  reminder_case1: {
    next_due_at: { type: Date, default: null },
    last_notified_at: { type: Date, default: null },
    last_rep_message_at: { type: Date, default: null },
    last_rep_user_id: { type: String, default: null },
    reminded_count: { type: Number, default: 0 },
    claim_until: { type: Date, default: null }
  },
  reminder_case2: {
    next_due_at: { type: Date, default: null },
    last_notified_at: { type: Date, default: null },
    last_customer_message_at: { type: Date, default: null },
    reminded_count: { type: Number, default: 0 },
    claim_until: { type: Date, default: null }
  }
}, {
  timestamps: true,
  collection: 'BotSession'
});

// Fast periodic scan for active rep-handled sessions and due reminder windows.
botSessionSchema.index({
  is_agent: 1,
  status: 1,
  'reminder_case1.next_due_at': 1,
  'reminder_case1.claim_until': 1
});

// Optional quick lookup for timeline checks/debugging around last rep message.
botSessionSchema.index({ 'reminder_case1.last_rep_message_at': 1 });
botSessionSchema.index({
  is_agent: 1,
  status: 1,
  'reminder_case2.next_due_at': 1,
  'reminder_case2.claim_until': 1
});
botSessionSchema.index({ 'reminder_case2.last_customer_message_at': 1 });

export default mongoose.model('BotSession', botSessionSchema);

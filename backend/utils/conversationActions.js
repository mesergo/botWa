// Shared "close conversation" (סיום שיחה) business logic.
//
// This is used by BOTH:
//  - The manual "close-conversation" button in the Sessions UI
//    (sessionController.js -> closeConversation, raw MongoDB driver updateOne)
//  - The "רכיב נציגים" (representatives) flow node's "close" action
//    (chatController.js -> action_transfer_to_agent / repActionType==='close',
//    mutates an in-memory Mongoose document mid bot-flow)
//
// Keeping the field list / history-entry format here avoids the two call sites
// drifting out of sync.

export const buildConversationClosedHistoryEntry = (now = new Date()) => ({
  type: 'System',
  text: 'השיחה הסתיימה',
  sender: 'system',
  name: 'מערכת',
  node_id: 'system',
  event: 'conversation_closed',
  created: now.toISOString()
});

// Dot-notation $set fragment for raw MongoDB driver updateOne() calls.
export const buildConversationClosedSetFragment = (now = new Date()) => ({
  is_agent: false,
  agent_since: null,
  status: 'closed',
  ended_at: now,
  'reminder_case1.next_due_at': null,
  'reminder_case1.claim_until': null,
  'reminder_case2.next_due_at': null,
  'reminder_case2.claim_until': null
});

// Mutates a Mongoose BotSession document in place (used mid bot-flow, where the
// document is saved later by the caller) and returns the history entry that was
// pushed onto process_history.
export const applyConversationClosedToDoc = (session, now = new Date()) => {
  const historyEntry = buildConversationClosedHistoryEntry(now);

  session.is_agent = false;
  session.agent_since = null;
  session.status = 'closed';
  session.ended_at = now;
  session.waiting_text_input = false;
  session.waiting_webservice = false;
  session.reminder_case1 = session.reminder_case1 || {};
  session.reminder_case2 = session.reminder_case2 || {};
  session.reminder_case1.next_due_at = null;
  session.reminder_case1.claim_until = null;
  session.reminder_case2.next_due_at = null;
  session.reminder_case2.claim_until = null;
  session.markModified('reminder_case1');
  session.markModified('reminder_case2');
  if (session.bot_override?.active) {
    session.bot_override = { active: false };
    session.markModified('bot_override');
  }

  session.process_history = session.process_history || [];
  session.process_history.push(historyEntry);
  session.markModified('process_history');

  return historyEntry;
};

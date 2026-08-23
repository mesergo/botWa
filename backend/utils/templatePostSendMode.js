import Dialog360TemplateSetting from '../models/Dialog360TemplateSetting.js';

/**
 * Resolve the configured post-send mode for a given template.
 * Returns 'no_change' when no setting exists (default / legacy behavior).
 *
 * @param {string} userId
 * @param {string} templateName
 * @returns {Promise<'no_change'|'agent'|'bot'>}
 */
export async function resolveTemplatePostSendMode(userId, templateName) {
  if (!userId || !templateName) return 'no_change';
  const setting = await Dialog360TemplateSetting.findOne({ templateName, userId }).lean();
  return setting?.postSendMode || 'no_change';
}

/**
 * Build the session field updates for a resolved post-send mode.
 * Mirrors `setAgentMode` / `clearAgentMode` field logic exactly, without
 * touching `current_node_id` / `execution_stack` (bot resumes where it left off).
 *
 * @param {'no_change'|'agent'|'bot'} mode
 * @param {string} currentStatus - the session's current status (used for 'agent' mode)
 * @returns {object|null} fields to merge into an update's $set, or null for 'no_change'
 */
export function buildPostSendModeFields(mode, currentStatus) {
  if (mode === 'agent') {
    return {
      is_agent: true,
      agent_since: new Date(),
      status: currentStatus === 'handling' ? 'handling' : 'waiting',
      'reminder_case1.next_due_at': null,
      'reminder_case1.claim_until': null,
      'reminder_case2.next_due_at': null,
      'reminder_case2.claim_until': null
    };
  }
  if (mode === 'bot') {
    return {
      is_agent: false,
      agent_since: null,
      status: 'bot',
      wants_phone: false,
      'reminder_case1.next_due_at': null,
      'reminder_case1.claim_until': null,
      'reminder_case2.next_due_at': null,
      'reminder_case2.claim_until': null
    };
  }
  return null;
}

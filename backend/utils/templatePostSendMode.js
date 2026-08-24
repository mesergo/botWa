// Per-template "post-send mode" — what happens to a conversation right after a
// specific WhatsApp template is sent.
//
// The mode is configured per user+template in the Dialog360 template settings
// (Dashboard → templates) and stored on Dialog360TemplateSetting.postSendMode.
//
// Shared by every template send path so they stay in sync:
//  - sessionController.js  -> sendAgentMessage / sendTemplateToPhone / sendAdminMessageToSession
//  - groupController.js    -> broadcast history fan-out

import Dialog360TemplateSetting from '../models/Dialog360TemplateSetting.js';

export const POST_SEND_MODES = ['no_change', 'agent', 'bot'];

const DEFAULT_MODE = 'no_change';

/**
 * Reads the configured post-send mode for one user's template.
 * Falls back to 'no_change' whenever nothing is configured or the lookup fails,
 * so a settings problem can never break an outgoing send.
 *
 * @param {string} userId
 * @param {string} templateName
 * @returns {Promise<'no_change'|'agent'|'bot'>}
 */
export const resolveTemplatePostSendMode = async (userId, templateName) => {
  if (!userId || !templateName) return DEFAULT_MODE;

  try {
    const setting = await Dialog360TemplateSetting
      .findOne({ templateName, userId: String(userId) })
      .select('postSendMode')
      .lean();

    const mode = setting?.postSendMode;
    return POST_SEND_MODES.includes(mode) ? mode : DEFAULT_MODE;
  } catch (err) {
    console.error('[postSendMode] lookup failed:', err?.message || err);
    return DEFAULT_MODE;
  }
};

/**
 * Builds the $set fragment that applies a post-send mode to a session.
 * Returns null for 'no_change' — the signal to callers that they should keep
 * whatever behavior they already computed.
 *
 * @param {'no_change'|'agent'|'bot'} mode
 * @param {string} [currentStatus] existing BotSession.status
 * @returns {{ status: string, is_agent: boolean, agent_since: Date|null }|null}
 */
export const buildPostSendModeFields = (mode, currentStatus, now = new Date()) => {
  if (mode === 'agent') {
    return {
      // A rep already mid-conversation stays in 'handling'; anything else is
      // handed over as a fresh item waiting for a rep to pick up.
      status: currentStatus === 'handling' ? 'handling' : 'waiting',
      is_agent: true,
      agent_since: now,
    };
  }

  if (mode === 'bot') {
    return {
      status: 'bot',
      is_agent: false,
      agent_since: null,
    };
  }

  return null;
};

import crypto from 'crypto';
import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';

// Resolve the Dialog360 bot id for a given user: prefer the user-level
// `dialog360_bot_id` field, otherwise fall back to the first BotFlow's
// `endpoint` field (which may be a bare id or `dialog360/{id}`).
// Mirrors the logic in adminController.getUserDialog360Templates /
// authController.getTemplates.
export const resolveDialog360BotId = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  let botId = user.dialog360_bot_id;

  if (!botId) {
    const firstBot = await BotFlow.findOne({
      user_id: userId.toString(),
      endpoint: { $exists: true, $ne: '' }
    }).sort({ created_at: 1 });
    if (firstBot && firstBot.endpoint) {
      const raw = firstBot.endpoint;
      botId = raw.includes('/') ? raw.split('/').pop() : raw;
    }
  }

  return botId || null;
};

// SHA1 token used by the wa.message.co.il / app.chatgo.live gateway.
export const dialog360Token = (botId) => {
  return crypto.createHash('sha1').update(botId + 'moomoo').digest('hex');
};

// POST helper for the wa.message.co.il template-management actions
// (add_template / edit_template / delete_template), matching the same
// addressing scheme (`dialog360/{botId}`) used by the `/send` endpoint.
export const callDialog360TemplateAction = async (botId, action, body) => {
  const url = `https://wa.message.co.il/api/dialog360/${botId}/${action}`;
  const token = dialog360Token(botId);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      token
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { ok: response.ok, status: response.status, data };
};

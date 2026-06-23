/**
 * whatsappSender.js
 * Shared utility for sending WhatsApp messages via wa.message.co.il.
 * Used by chatController (bot messages) and sessionController (agent messages).
 */
import crypto from 'crypto';
import fetch from 'node-fetch';

const _sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Build WhatsApp API credentials from a bot or user object (or fall back to env vars).
 * Priority: bot.endpoint > user.dialog360_bot_id > env vars.
 * @param {Object|null} user - User document with optional dialog360_bot_id
 * @param {Object|null} bot  - BotFlow document with optional endpoint field
 * @returns {{ endpoint: string, waToken: string }}
 */
export const buildWACredentials = (user = null, bot = null) => {
  let endpoint, waToken;
  if (bot && bot.endpoint) {
    const rawEndpoint = bot.endpoint;
    // If stored as bare ID (no slash), prefix with dialog360/
    endpoint = rawEndpoint.includes('/') ? rawEndpoint : `dialog360/${rawEndpoint}`;
    const botIdPart = endpoint.split('/').pop();
    waToken = crypto.createHash('sha1').update(botIdPart + 'moomoo').digest('hex');
  } else if (user && user.dialog360_bot_id) {
    endpoint = `dialog360/${user.dialog360_bot_id}`;
    waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
  } else {
    endpoint = null;
    waToken = null;
  }
  return { endpoint, waToken };
};

/**
 * Normalize a phone number to Israeli E.164 format (digits only, starting with 972).
 * @param {string} phone
 * @returns {string}
 */
export const normalizePhone = (phone) => {
  let normalized = String(phone).replace(/[^0-9]/g, '');
  normalized = normalized.replace(/^972972/, '972');
  if (!normalized.startsWith('972')) {
    normalized = normalized.replace(/^0+/, '');
    normalized = '972' + normalized;
  }
  return normalized;
};

/**
 * Send an array of bot/agent messages to WhatsApp via wa.message.co.il.
 * Handles: Text, Options, Image, Video, Document, URL, SendItem.
 *
 * @param {string} phone - Raw phone number (will be normalized internally)
 * @param {Array}  messages - Array of message objects { type, text, url, options, ... }
 * @param {Object|null} user - User document (for per-account credentials)
 * @param {Object|null} bot  - BotFlow document with optional endpoint field (takes priority over user)
 * @returns {Promise<boolean>} true if at least one message was delivered
 */
// WhatsApp text message character limit
const WA_MAX_TEXT = 4000;
// WhatsApp interactive message (text + buttons) body limit
const WA_MAX_INTERACTIVE_BODY = 1024;

/**
 * Split a long text into chunks of at most maxLen chars, splitting on newlines when possible.
 */
const splitText = (text, maxLen = WA_MAX_TEXT) => {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt <= 0) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
};

export const pushMessagesToWhatsApp = async (phone, messages, user = null, bot = null) => {
  if (!messages || !messages.length) return false;

  const { endpoint, waToken } = buildWACredentials(user, bot);
  if (!endpoint) return false;

  const normalizedPhone = normalizePhone(phone);

  console.log(`[WA-PUSH] 📞 Sending to phone=${normalizedPhone} via endpoint=${endpoint}${bot?.endpoint ? ' (bot.endpoint)' : user?.dialog360_bot_id ? ' (user dialog360_bot_id)' : ' (fallback)'}`);

  const sendOne = async (body) => {
    try {
      const res = await fetch(`https://wa.message.co.il/api/${endpoint}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
          'token': waToken,
        },
        body: JSON.stringify({ ...body, phone: normalizedPhone, fromMe: 1 }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[WA-PUSH] ❌ HTTP ${res.status} | body: ${JSON.stringify(body).substring(0, 100)} | resp: ${errText.substring(0, 200)}`);
        return false;
      }
      const kind = body.image ? 'image' : body.video ? 'video' : body.file ? 'file' : body.buttons ? 'buttons' : 'text';
      console.log(`[WA-PUSH] ✅ Sent ${kind} to ${normalizedPhone}`);
      return true;
    } catch (err) {
      console.error('[WA-PUSH] ❌ Exception:', err.message);
      return false;
    }
  };

  let textBuffer = '';
  let anySuccess = false;

  for (const msg of messages) {
    switch (msg.type) {
      case 'Text':
        if (msg.text) textBuffer += msg.text + '\n';
        break;

      case 'Options': {
        // Prefer accumulated textBuffer; fall back to text embedded in the Options message.
        const headerText = textBuffer.trim() || (msg.text && msg.text.trim()) || '';
        // Interactive messages (text + buttons) have a 1024-char body limit.
        // If text exceeds that, flush it as plain text chunks first, then send buttons alone.
        if (headerText.length > WA_MAX_INTERACTIVE_BODY) {
          for (const chunk of splitText(headerText)) {
            if (await sendOne({ text: chunk })) anySuccess = true;
            await _sleep(300);
          }
          // After flushing long text, still need to send the buttons with a minimal body
          const btnBodyText = msg.text && msg.text.trim() ? msg.text.trim().substring(0, WA_MAX_INTERACTIVE_BODY) : null;
          if (btnBodyText) {
            if (await sendOne({ text: btnBodyText, buttons: msg.options })) anySuccess = true;
          }
        } else if (headerText) {
          if (await sendOne({ text: headerText, buttons: msg.options })) anySuccess = true;
        } else {
          // No body text — WhatsApp requires non-empty body; send options as plain text list
          const fallbackText = msg.options.join('\n');
          if (fallbackText && await sendOne({ text: fallbackText })) anySuccess = true;
        }
        textBuffer = '';
        await _sleep(400);
        break;
      }

      case 'Image': {
        if (textBuffer.trim()) { for (const chunk of splitText(textBuffer.trim())) { if (await sendOne({ text: chunk })) anySuccess = true; await _sleep(300); } textBuffer = ''; await _sleep(100); }
        console.log(`[WA-PUSH] 🖼  Sending IMAGE | url=${msg.url?.substring(0, 80)} | caption=${msg.text?.substring(0, 40) || '(none)'}`);
        if (await sendOne({ image: msg.url, text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'Video': {
        if (textBuffer.trim()) { for (const chunk of splitText(textBuffer.trim())) { if (await sendOne({ text: chunk })) anySuccess = true; await _sleep(300); } textBuffer = ''; await _sleep(100); }
        console.log(`[WA-PUSH] 🎬 Sending VIDEO | url=${msg.url?.substring(0, 80)} | caption=${msg.text?.substring(0, 40) || '(none)'}`);
        if (await sendOne({ video: msg.url, text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'Document': {
        if (textBuffer.trim()) { for (const chunk of splitText(textBuffer.trim())) { if (await sendOne({ text: chunk })) anySuccess = true; await _sleep(300); } textBuffer = ''; await _sleep(100); }
        console.log(`[WA-PUSH] 📄 Sending DOCUMENT | url=${msg.url?.substring(0, 80)} | filename=${msg.filename || 'file'}`);
        if (await sendOne({ file: msg.url, filename: msg.filename || 'file', text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'URL':
        // Append URL to text buffer — dialog360 linkifies plain URLs in text
        textBuffer += `${msg.text ? msg.text + '\n' : ''}${msg.url}\n`;
        break;

      case 'SendItem': {
        if (textBuffer.trim()) { for (const chunk of splitText(textBuffer.trim())) { if (await sendOne({ text: chunk })) anySuccess = true; await _sleep(300); } textBuffer = ''; await _sleep(100); }
        const itemText = [msg.title, msg.subtitle].filter(Boolean).join('\n');
        const btnList = (msg.options || []).map(o =>
          typeof o === 'string' ? o : (o.label || o.text || o.value || String(o))
        );
        if (await sendOne(btnList.length > 0 ? { text: itemText, buttons: btnList } : { text: itemText })) anySuccess = true;
        await _sleep(400);
        break;
      }

      default:
        break;
    }
  }

  // Flush any remaining accumulated text (split if too long)
  if (textBuffer.trim()) {
    const chunks = splitText(textBuffer.trim());
    for (let i = 0; i < chunks.length; i++) {
      if (await sendOne({ text: chunks[i] })) anySuccess = true;
      if (i < chunks.length - 1) await _sleep(300);
    }
  }

  console.log(`[WA-PUSH] 🏁 anySuccess=${anySuccess}`);
  return anySuccess;
};

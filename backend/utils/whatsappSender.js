/**
 * whatsappSender.js
 * Shared utility for sending WhatsApp messages via wa.message.co.il.
 * Used by chatController (bot messages) and sessionController (agent messages).
 */
import crypto from 'crypto';
import fetch from 'node-fetch';

const _sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Build WhatsApp API credentials from a user object (or fall back to env vars).
 * @param {Object|null} user - User document with optional dialog360_bot_id
 * @returns {{ endpoint: string, waToken: string }}
 */
export const buildWACredentials = (user = null) => {
  let endpoint, waToken;
  if (user && user.dialog360_bot_id) {
    endpoint = `dialog360/${user.dialog360_bot_id}`;
    waToken = crypto.createHash('sha1').update(user.dialog360_bot_id + 'moomoo').digest('hex');
  } else {
    endpoint = process.env.WHATSAPP_ENDPOINT || 'dialog360/65aec7ebf1a1d64f29645fd9';
    waToken = process.env.WHATSAPP_API_TOKEN ||
      crypto.createHash('sha1').update(endpoint + 'moomoo').digest('hex');
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
 * @returns {Promise<boolean>} true if at least one message was delivered
 */
export const pushMessagesToWhatsApp = async (phone, messages, user = null) => {
  if (!messages || !messages.length) return false;

  const { endpoint, waToken } = buildWACredentials(user);
  if (!endpoint) return false;

  const normalizedPhone = normalizePhone(phone);

  console.log(`[WA-PUSH] 📞 Sending to phone=${normalizedPhone} via endpoint=${endpoint}${user && user.dialog360_bot_id ? ' (user dialog360_bot_id)' : ' (fallback)'}`);

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
        const headerText = textBuffer.trim() || ' ';
        if (await sendOne({ text: headerText, buttons: msg.options })) anySuccess = true;
        textBuffer = '';
        await _sleep(400);
        break;
      }

      case 'Image': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ image: msg.url, text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'Video': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ video: msg.url, text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'Document': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ file: msg.url, filename: msg.filename || 'file', text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'URL':
        // Append URL to text buffer — dialog360 linkifies plain URLs in text
        textBuffer += `${msg.text ? msg.text + '\n' : ''}${msg.url}\n`;
        break;

      case 'SendItem': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
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

  // Flush any remaining accumulated text
  if (textBuffer.trim()) {
    if (await sendOne({ text: textBuffer.trim() })) anySuccess = true;
  }

  console.log(`[WA-PUSH] 🏁 anySuccess=${anySuccess}`);
  return anySuccess;
};

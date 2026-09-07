import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ErrorLog from './ErrorLog.model.js';
import { nextSequence } from './Counter.model.js';

// Loaded via fs (rather than a JSON import-attribute) to avoid depending on a
// specific Node.js version supporting `import ... with { type: 'json' }`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const translations = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'errorTranslations.json'), 'utf8')
);

const HEBREW_RE = /[֐-׿]/;

// Reverse lookup: every dictionary entry maps a known string to its translation
// in the other language, so we can find a match starting from either side.
const reverseTranslations = Object.fromEntries(
  Object.entries(translations).map(([k, v]) => [v, k])
);

/**
 * Best-effort bilingual split of a single raw error message.
 * Not machine translation — this project has no translation API. It only
 * recognizes a small static dictionary of known recurring strings; anything
 * else gets a generic fallback in the language it wasn't written in, with the
 * original text always preserved (in whichever field matches its language).
 */
const deriveBilingual = (rawMessage) => {
  const text = String(rawMessage || '').trim() || 'Unknown error';
  if (translations[text]) return { message_he: text, message_en: translations[text] };
  if (reverseTranslations[text]) return { message_he: reverseTranslations[text], message_en: text };
  if (HEBREW_RE.test(text)) {
    return { message_he: text, message_en: 'System error — see Hebrew detail' };
  }
  return { message_he: 'שגיאת מערכת', message_en: text };
};

/**
 * Persists one error occurrence to the ErrorLog collection. Fire-and-forget:
 * callers should NOT await this in a way that delays a response, and it never
 * throws — a logging failure must never break the request/flow that triggered it.
 *
 * @param {Object} params
 * @param {'auth'|'whatsapp_send'|'webhook'|'api'|'client_ui'|'network'|'internal'} params.category
 * @param {string} [params.source] - e.g. "POST /api/admin/users" or "whatsappSender.sendOne"
 * @param {string} [params.message] - raw error text (Hebrew or English)
 * @param {string|null} [params.clientId] - platform tenant (User) id, if known
 * @param {string|null} [params.clientName] - denormalized snapshot (email/business name)
 * @param {string|null} [params.endCustomerPhone] - end WhatsApp customer's phone, if applicable
 * @param {number} [params.statusCode]
 * @param {string} [params.stack]
 * @param {Object} [params.details] - free-form extra context
 */
export const logError = async ({
  category,
  source = null,
  message = '',
  clientId = null,
  clientName = null,
  endCustomerPhone = null,
  statusCode = null,
  stack = null,
  details = null,
} = {}) => {
  try {
    const { message_he, message_en } = deriveBilingual(message);
    const seq = await nextSequence('errorLogSeq');
    await ErrorLog.create({
      seq,
      category,
      source,
      message_he,
      message_en,
      client_id: clientId || null,
      client_name: clientName || null,
      end_customer_phone: endCustomerPhone || null,
      status_code: statusCode || null,
      stack: stack || null,
      details: details || null,
    });
  } catch (err) {
    console.error('[ErrorLog] Failed to persist error log entry:', err.message);
  }
};

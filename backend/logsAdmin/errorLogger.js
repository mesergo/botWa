import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import ErrorLog from './ErrorLog.model.js';
import { nextSequence } from './Counter.model.js';

// Loaded via fs (rather than a JSON import-attribute) to avoid depending on a
// specific Node.js version supporting `import ... with { type: 'json' }`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const translations = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'errorTranslations.json'), 'utf8')
);

// Errors that happen *because* the database is unreachable (e.g. every login
// attempt during an outage) can't be persisted to the ErrorLog collection —
// that would just fail the same way. Without a fallback they vanish silently
// and the admin tab shows nothing for the exact incident it exists to catch.
// So a failed write is appended here instead (one JSON object per line) and
// replayed into ErrorLog as soon as Mongo reconnects.
const FALLBACK_FILE = path.join(__dirname, 'fallback-errors.ndjson');
let flushing = false;

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
  const { message_he, message_en } = deriveBilingual(message);
  const entry = {
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
  };
  try {
    const seq = await nextSequence('errorLogSeq');
    await ErrorLog.create({ ...entry, seq });
  } catch (err) {
    console.error('[ErrorLog] Failed to persist error log entry — writing to local fallback file instead:', err.message);
    await appendToFallback(entry);
  }
};

const appendToFallback = async (entry) => {
  try {
    const line = JSON.stringify({ ...entry, _occurredAt: new Date().toISOString() });
    await fsPromises.appendFile(FALLBACK_FILE, line + '\n', 'utf8');
  } catch (fsErr) {
    // Nothing left to fall back to — surface it in the process logs only.
    console.error('[ErrorLog] Failed to write fallback error log file too:', fsErr.message);
  }
};

/**
 * Replays every entry accumulated in the fallback file (written while Mongo
 * was unreachable) into the ErrorLog collection, assigning real sequence
 * numbers now that the database is back. Safe to call opportunistically —
 * a no-op when the file doesn't exist or is empty, and guarded against
 * overlapping runs (triggered both by the mongoose 'connected' event and,
 * as a belt-and-suspenders check, by the admin tab's list endpoint).
 */
export const flushFallbackErrorLog = async () => {
  if (flushing) return;
  let raw;
  try {
    raw = await fsPromises.readFile(FALLBACK_FILE, 'utf8');
  } catch {
    return;
  }
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return;

  flushing = true;
  console.log(`[ErrorLog] Flushing ${lines.length} error log entr${lines.length === 1 ? 'y' : 'ies'} recorded while the database was unavailable...`);
  const stillFailed = [];
  try {
    for (const line of lines) {
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue; // corrupt line — drop it rather than block the rest
      }
      const { _occurredAt, ...entry } = parsed;
      try {
        const seq = await nextSequence('errorLogSeq');
        await ErrorLog.create({ ...entry, seq, details: { ...(entry.details || {}), occurredAt: _occurredAt } });
      } catch {
        stillFailed.push(line);
      }
    }
    if (stillFailed.length) {
      await fsPromises.writeFile(FALLBACK_FILE, stillFailed.join('\n') + '\n', 'utf8');
    } else {
      await fsPromises.unlink(FALLBACK_FILE).catch(() => {});
    }
  } finally {
    flushing = false;
  }
};

mongoose.connection.on('connected', () => {
  flushFallbackErrorLog().catch((err) => console.error('[ErrorLog] Fallback flush failed:', err.message));
});

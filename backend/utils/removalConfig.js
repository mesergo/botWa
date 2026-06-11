// Helpers for the "auto-removal from group" feature.
// When a contact sends a message that matches one of the configured keywords,
// their phone is added to the user's blocklist and a confirmation message is
// sent back. Config is layered: per-user override → global SystemSetting → built-in defaults.

import SystemSetting from '../models/SystemSetting.js';

// Built-in default keywords (Hebrew + English) and reply message.
// Exposed so the frontend can show the "reset to defaults" baseline.
export const DEFAULT_REMOVAL_CONFIG = {
  enabled: true,
  keywords: [
    'הסר',
    'הסרה',
    'הסירו',
    'הסר אותי',
    'הסירו אותי',
    'תסיר',
    'תסירו',
    'תסירו אותי',
    'הורד',
    'הורידו אותי',
    'להסיר',
    'להסירני',
    'הפסק',
    'הפסיקו',
    'הפסיקו לשלוח',
    'אל תשלחו',
    'די',
    'לבטל',
    'ביטול',
    'בטל מנוי',
    'בטלו מנוי',
    'remove',
    'remove me',
    'unsubscribe',
    'stop',
    'stop messages',
    'opt out',
    'optout',
    'cancel',
    'quit',
    'end'
  ],
  message: 'הוסרת בהצלחה מרשימת התפוצה. לא נשלח אליך יותר הודעות. תודה!'
};

// Load the global default config (admin-managed) merged with built-in defaults.
export const getGlobalRemovalConfig = async () => {
  try {
    const setting = await SystemSetting.findOne({ key: 'removal_config' });
    if (setting && setting.value) {
      return { ...DEFAULT_REMOVAL_CONFIG, ...setting.value };
    }
  } catch (err) {
    console.error('[removalConfig] Failed to load global config:', err.message);
  }
  return { ...DEFAULT_REMOVAL_CONFIG };
};

// Resolve the effective config for a specific user:
// per-user override (only the fields the user customised) over global config.
export const getEffectiveRemovalConfig = async (user) => {
  const global = await getGlobalRemovalConfig();
  const override = user?.removal_config || null;
  if (!override || !override.customized) return global;

  return {
    enabled: typeof override.enabled === 'boolean' ? override.enabled : global.enabled,
    keywords: Array.isArray(override.keywords) && override.keywords.length > 0
      ? override.keywords
      : global.keywords,
    message: typeof override.message === 'string' && override.message.trim()
      ? override.message
      : global.message
  };
};

// Normalize a string for matching: trim, lowercase, collapse whitespace,
// strip common Hebrew niqqud/punctuation that users sometimes type.
const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '')      // Hebrew niqqud
    .replace(/[.,!?״"׳'״׳:;()\-\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Returns the matched keyword, or null if no keyword matched.
// A keyword matches when the (normalized) incoming text equals the keyword
// or contains it as a whole-word substring.
export const matchRemovalKeyword = (text, keywords) => {
  if (!text || !Array.isArray(keywords) || keywords.length === 0) return null;
  const t = normalize(text);
  if (!t) return null;
  for (const raw of keywords) {
    const kw = normalize(raw);
    if (!kw) continue;
    if (t === kw) return raw;
    // whole-word containment (handles "תסירו אותי בבקשה" etc.)
    const re = new RegExp(`(^|\\s)${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(\\s|$)`);
    if (re.test(t)) return raw;
  }
  return null;
};

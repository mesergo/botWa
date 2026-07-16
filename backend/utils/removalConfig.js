// Helpers for the "auto-removal from group" feature.
// When a contact sends a message that matches one of the configured keywords,
// their phone is added to the user's blocklist and a confirmation message is
// sent back. Config is layered: per-user override → global SystemSetting → built-in defaults.
// Keywords and confirmation messages are split by language: Hebrew (he) and English (en).

import SystemSetting from '../models/SystemSetting.js';

// Built-in default keywords split by language, with a separate confirmation message per language.
// Exposed so the frontend can show the "reset to defaults" baseline.
export const DEFAULT_REMOVAL_CONFIG = {
  enabled: true,
  keywords_he: [
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
    'בטלו מנוי'
  ],
  message_he: 'הוסרת בהצלחה מרשימת התפוצה. לא נשלח אליך יותר הודעות. תודה!',
  keywords_en: [
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
  message_en: 'You have been successfully removed from our mailing list. No further messages will be sent to you. Thank you!'
};

// Migrate a legacy config (with flat `keywords` + `message`) to the split format.
// This ensures backward compatibility with data saved before the he/en split.
const migrateLegacyConfig = (cfg) => {
  if (!cfg) return cfg;
  if (cfg.keywords_he !== undefined || cfg.keywords_en !== undefined) return cfg; // already new format
  const legacy = Array.isArray(cfg.keywords) ? cfg.keywords : [];
  const hePattern = /[\u05D0-\u05EA]/;
  return {
    enabled: cfg.enabled,
    keywords_he: legacy.filter(k => hePattern.test(k)),
    message_he: cfg.message || DEFAULT_REMOVAL_CONFIG.message_he,
    keywords_en: legacy.filter(k => !hePattern.test(k)),
    message_en: DEFAULT_REMOVAL_CONFIG.message_en
  };
};

// Load the global default config (admin-managed) merged with built-in defaults.
export const getGlobalRemovalConfig = async () => {
  try {
    const setting = await SystemSetting.findOne({ key: 'removal_config' });
    if (setting && setting.value) {
      const val = migrateLegacyConfig(setting.value);
      return { ...DEFAULT_REMOVAL_CONFIG, ...val };
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

  // Migrate legacy override if needed (saved before the he/en split)
  const ov = migrateLegacyConfig(override);

  return {
    enabled: typeof ov.enabled === 'boolean' ? ov.enabled : global.enabled,
    keywords_he: Array.isArray(ov.keywords_he) && ov.keywords_he.length > 0
      ? ov.keywords_he
      : global.keywords_he,
    message_he: typeof ov.message_he === 'string' && ov.message_he.trim()
      ? ov.message_he
      : global.message_he,
    keywords_en: Array.isArray(ov.keywords_en) && ov.keywords_en.length > 0
      ? ov.keywords_en
      : global.keywords_en,
    message_en: typeof ov.message_en === 'string' && ov.message_en.trim()
      ? ov.message_en
      : global.message_en
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

// Internal: check if text matches any keyword in the given list.
// Returns the matched raw keyword or null.
const matchInList = (normalizedText, keywords) => {
  if (!Array.isArray(keywords)) return null;
  for (const raw of keywords) {
    const kw = normalize(raw);
    if (!kw) continue;
    if (normalizedText === kw) return raw;
    // whole-word containment (handles "תסירו אותי בבקשה" etc.)
    const re = new RegExp(`(^|\\s)${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(\\s|$)`);
    if (re.test(normalizedText)) return raw;
  }
  return null;
};

// Returns { matched, lang } where lang is 'he' or 'en', or null if no keyword matched.
// Hebrew keywords are checked first, then English.
export const matchRemovalKeywordWithLang = (text, cfg) => {
  if (!text || !cfg) return null;
  const t = normalize(text);
  if (!t) return null;
  const heMatch = matchInList(t, cfg.keywords_he);
  if (heMatch) return { matched: heMatch, lang: 'he' };
  const enMatch = matchInList(t, cfg.keywords_en);
  if (enMatch) return { matched: enMatch, lang: 'en' };
  return null;
};

// Legacy export kept for any callers that still use the old signature.
// Checks both language lists and returns the matched keyword string or null.
export const matchRemovalKeyword = (text, keywords) => {
  if (!text || !Array.isArray(keywords) || keywords.length === 0) return null;
  const t = normalize(text);
  if (!t) return null;
  return matchInList(t, keywords);
};

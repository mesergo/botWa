import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonHe from './locales/he/common.json';
import authHe from './locales/he/auth.json';
import navHe from './locales/he/nav.json';
import editorHe from './locales/he/editor.json';
import contactsHe from './locales/he/contacts.json';
import usersHe from './locales/he/users.json';
import messagesHe from './locales/he/messages.json';
import smsInHe from './locales/he/smsIn.json';
import builderHe from './locales/he/builder.json';
import dashboardHe from './locales/he/dashboard.json';
import sessionsHe from './locales/he/sessions.json';
import groupsHe from './locales/he/groups.json';
import internalDataHe from './locales/he/internalData.json';
import commonEn from './locales/en/common.json';
import authEn from './locales/en/auth.json';
import navEn from './locales/en/nav.json';
import editorEn from './locales/en/editor.json';
import contactsEn from './locales/en/contacts.json';
import usersEn from './locales/en/users.json';
import messagesEn from './locales/en/messages.json';
import smsInEn from './locales/en/smsIn.json';
import builderEn from './locales/en/builder.json';
import dashboardEn from './locales/en/dashboard.json';
import sessionsEn from './locales/en/sessions.json';
import groupsEn from './locales/en/groups.json';
import internalDataEn from './locales/en/internalData.json';

export const LANGUAGE_STORAGE_KEY = 'mesergo_locale';
export type SupportedLanguage = 'he' | 'en';

const supportedLanguages: SupportedLanguage[] = ['he', 'en'];

const normalizeLanguage = (language?: string | null): SupportedLanguage =>
  supportedLanguages.includes(language as SupportedLanguage)
    ? (language as SupportedLanguage)
    : 'he';

export const getFormatLocale = (language = i18n.resolvedLanguage): 'he-IL' | 'en-GB' =>
  normalizeLanguage(language) === 'en' ? 'en-GB' : 'he-IL';

const applyDocumentLanguage = (language?: string | null) => {
  const normalizedLanguage = normalizeLanguage(language);
  document.documentElement.lang = normalizedLanguage;
  // Physical layout direction is always RTL regardless of the selected language, so the
  // sidebar/navbar/tabs stay in the same position when switching languages. Only text
  // content and formatting (dates/numbers) follow the selected language. Content that must
  // stay Latin-oriented regardless of page language (phone numbers, emails, URLs) sets its
  // own dir="ltr" locally and is unaffected.
  document.documentElement.dir = 'rtl';
};

const initialLanguage = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      he: {
        common: commonHe,
        auth: authHe,
        nav: navHe,
        editor: editorHe,
        contacts: contactsHe,
        users: usersHe,
        messages: messagesHe,
        smsIn: smsInHe,
        builder: builderHe,
        dashboard: dashboardHe,
        sessions: sessionsHe,
        groups: groupsHe,
        internalData: internalDataHe,
      },
      en: {
        common: commonEn,
        auth: authEn,
        nav: navEn,
        editor: editorEn,
        contacts: contactsEn,
        users: usersEn,
        messages: messagesEn,
        smsIn: smsInEn,
        builder: builderEn,
        dashboard: dashboardEn,
        sessions: sessionsEn,
        groups: groupsEn,
        internalData: internalDataEn,
      },
    },
    lng: initialLanguage,
    fallbackLng: 'he',
    supportedLngs: supportedLanguages,
    defaultNS: 'common',
    ns: ['common', 'auth', 'nav', 'editor', 'contacts', 'users', 'messages', 'smsIn', 'builder', 'dashboard', 'sessions', 'groups', 'internalData'],
    interpolation: { escapeValue: false },
    returnNull: false,
  });

applyDocumentLanguage(initialLanguage);

i18n.on('languageChanged', (language) => {
  const normalizedLanguage = normalizeLanguage(language);
  localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
  applyDocumentLanguage(normalizedLanguage);
});

export default i18n;

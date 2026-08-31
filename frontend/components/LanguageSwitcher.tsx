import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = ['he', 'en'] as const;

interface LanguageSwitcherProps {
  /** floating = auth screens, menu = profile/sidebar, bar = compact control in the app top bar */
  variant?: 'floating' | 'menu' | 'bar';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'floating' }) => {
  const { t, i18n } = useTranslation('common');
  const currentLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'he';

  const buttons = LANGUAGES.map((language) => {
    const isActive = currentLanguage === language;
    const label = t(language === 'he' ? 'language.hebrew' : 'language.english');
    const compact = variant === 'menu' || variant === 'bar';

    return (
      <button
        key={language}
        type="button"
        onClick={() => void i18n.changeLanguage(language)}
        aria-pressed={isActive}
        className={
          compact
            ? `flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`
            : `rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`
        }
      >
        {label}
      </button>
    );
  });

  if (variant === 'menu') {
    return (
      <div className="px-4 pt-1 pb-2">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span title={t('language.label')} className="text-slate-400 flex-shrink-0"><Globe size={14} /></span>
          <span className="text-[11px] font-bold text-slate-400">{t('language.label')}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1" role="group" aria-label={t('language.label')}>
          {buttons}
        </div>
      </div>
    );
  }

  if (variant === 'bar') {
    return (
      <div
        className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 min-w-[148px]"
        role="group"
        aria-label={t('language.label')}
      >
        {buttons}
      </div>
    );
  }

  // Floating variant (pre-login auth screens). `end-4` keeps this pinned to the visual top-left in
  // Hebrew (inline-end === left under RTL, identical to the previous `left-4`) and mirrors it to the
  // top-right in English.
  return (
    <div
      className="fixed top-4 end-4 z-[100] flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur"
      role="group"
      aria-label={t('language.label')}
    >
      {buttons}
    </div>
  );
};

export default LanguageSwitcher;

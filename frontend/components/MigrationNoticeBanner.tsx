import React, { useState } from 'react';

const DISMISS_KEY = 'migration-notice-dismissed-v1';

/**
 * Small, subtle site-wide notice informing users about the upcoming move
 * to the new app.message.co.il link/version. Dismissible (persisted in localStorage).
 */
const MigrationNoticeBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
    setDismissed(true);
  };

  return (
    <div
      className="bg-red-50 border-b border-red-200 text-red-800 px-4 py-1.5 flex items-center justify-between gap-3 text-xs sm:text-sm flex-shrink-0 z-20"
      dir="rtl"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span>שימו לב: בימים הקרובים נעבור לקישור חדש עם גרסה משודרגת.</span>
        <a
          href="https://app.message.co.il/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline hover:text-red-900 transition-colors"
        >
          למעבר לחצו כאן
        </a>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="סגור הודעה"
        className="text-red-500 hover:text-red-700 transition-colors text-base leading-none px-1 flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
};

export default MigrationNoticeBanner;

import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ActiveContactsQuotaToastProps {
  /** Current active-contacts count for the account */
  count: number;
  /** Configured limit (from limits_in_effect.maxActiveContacts) */
  limit?: number;
  /** Bump this value to force the toast to re-show / restart its auto-dismiss timer (e.g. on navigation) */
  triggerKey: string | number;
}

const AUTO_DISMISS_MS = 8000;

/**
 * Small bottom toast shown to account owners (or admins impersonating them) when the
 * account has exceeded its "active contacts" (60-day) quota. Re-appears on every
 * navigation via the `triggerKey` prop. See plan: activeContactsQuota.
 */
const ActiveContactsQuotaToast: React.FC<ActiveContactsQuotaToastProps> = ({ count, limit, triggerKey }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [triggerKey]);

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      role="status"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 z-[9999] max-w-sm w-[calc(100%-2.5rem)] sm:w-auto bg-rose-600 text-white rounded-2xl shadow-2xl shadow-rose-900/30 px-5 py-4 flex items-start gap-3 animate-fade-in-up"
    >
      <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm font-bold leading-relaxed">
        עברת את מכסת אנשי הקשר הפעילים בחשבון שלך ({count}{limit !== undefined ? `/${limit}` : ''}).
        לשדרוג המכסה יש ליצור קשר עם המשרד.
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
        aria-label="סגור"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ActiveContactsQuotaToast;

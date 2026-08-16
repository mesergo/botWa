/**
 * Notifications controls for any authenticated user.
 * Permission only on explicit click. Bot-line prefs only when multiple lines exist.
 */

import React from 'react';
import type { UsePushNotificationsResult } from '../hooks/usePushNotifications';

export interface EnableNotificationsButtonProps {
  notifications: UsePushNotificationsResult;
  className?: string;
  enableLabel?: string;
  disableLabel?: string;
  enabledLabel?: string;
  showTestButton?: boolean;
  testLabel?: string;
}

export const EnableNotificationsButton: React.FC<EnableNotificationsButtonProps> = ({
  notifications,
  className,
  enableLabel = 'הפעל התראות',
  disableLabel = 'השבת התראות',
  enabledLabel = 'התראות מופעלות',
  showTestButton = true,
  testLabel = 'שלח התראת בדיקה',
}) => {
  const {
    enabled,
    loading,
    error,
    permission,
    botLines,
    allBotLines,
    selectedBotLineIds,
    setAllBotLines,
    toggleBotLine,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
  } = notifications;

  if (permission === 'unsupported') {
    return (
      <p className={className} role="status">
        הדפדפן אינו תומך בהתראות Push
      </p>
    );
  }

  if (permission === 'denied') {
    return (
      <p className={className} role="status">
        ההרשאה להתראות נחסמה. יש לאפשר אותה בהגדרות הדפדפן.
      </p>
    );
  }

  const showLinePicker = botLines.length > 1 && !enabled;

  return (
    <div className={className} dir="rtl">
      {showLinePicker ? (
        <div className="mb-2 text-right space-y-1 max-w-xs">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={allBotLines}
              onChange={(e) => setAllBotLines(e.target.checked)}
            />
            קבל התראות מכל קווי הבוט
          </label>
          {!allBotLines ? (
            <div className="pr-1 space-y-1 border-r-2 border-slate-100">
              {botLines.map((line) => (
                <label key={line.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBotLineIds.includes(line.id)}
                    onChange={() => toggleBotLine(line.id)}
                  />
                  <span>
                    {line.name}
                    {line.displayPhone ? ` (${line.displayPhone})` : ''}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        {enabled ? (
          <>
            <span
              role="status"
              className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full"
            >
              {enabledLabel}
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={() => void disableNotifications()}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1"
            >
              {loading ? '...' : disableLabel}
            </button>
            {showTestButton ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void sendTestNotification()}
                className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full hover:bg-blue-100 disabled:opacity-60"
              >
                {loading ? '...' : testLabel}
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void enableNotifications()}
            className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-full shadow-sm disabled:opacity-60"
          >
            {loading ? '...' : enableLabel}
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-600 mt-1 font-medium max-w-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default EnableNotificationsButton;

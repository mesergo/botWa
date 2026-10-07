/**
 * Push notifications panel for any authenticated user on SessionsPage.
 * Never asks for userId/tenantId — Backend derives them from the JWT.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  createDeviceRegistrationService,
  usePushNotifications,
  EnableNotificationsButton,
} from '@notifications';

const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : `${typeof window !== 'undefined' ? window.location.origin : ''}/api`;

interface RepPushNotificationsProps {
  token: string;
}

const RepPushNotifications: React.FC<RepPushNotificationsProps> = ({ token }) => {
  const [pushToast, setPushToast] = useState<string | null>(null);

  const deviceService = useMemo(
    () =>
      createDeviceRegistrationService({
        apiBaseUrl: `${API_BASE}/push-notifications`,
        getAccessToken: () => token || null,
      }),
    [token]
  );

  const vapidKey = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FIREBASE_VAPID_PUBLIC_KEY || '';

  const notifications = usePushNotifications({
    deviceService,
    vapidKey,
    getServiceWorkerRegistration: async () => {
      if (!('serviceWorker' in navigator)) return undefined;
      return navigator.serviceWorker.register('/firebase-messaging-sw.js');
    },
    onForegroundMessage: (msg: { title?: string; body?: string; data?: Record<string, string | undefined> }) => {
      const text = [msg.title, msg.body].filter(Boolean).join(' — ') || 'התראה חדשה';
      setPushToast(text);
      window.setTimeout(() => setPushToast(null), 5000);
    },
  });

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  useEffect(() => {
    if (!notifications.enabled) return;
    let cancelled = false;
    deviceService
      .getEmailPreference()
      .then((pref) => {
        if (cancelled) return;
        setEmailEnabled(pref.enabled);
        setEmailAddress(pref.email);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deviceService, notifications.enabled]);

  const toggleEmail = async (next: boolean) => {
    setEmailSaving(true);
    try {
      const pref = await deviceService.setEmailPreference(next);
      setEmailEnabled(pref.enabled);
      setEmailAddress(pref.email);
    } catch {
      setPushToast('שמירת הגדרת המייל נכשלה');
      window.setTimeout(() => setPushToast(null), 5000);
    } finally {
      setEmailSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <EnableNotificationsButton notifications={notifications} showTestButton />
        {notifications.enabled ? (
          <label
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full cursor-pointer"
            title={emailAddress ? `התראות יישלחו אל ${emailAddress}` : undefined}
            dir="rtl"
          >
            <input
              type="checkbox"
              checked={emailEnabled}
              disabled={emailSaving}
              onChange={(e) => void toggleEmail(e.target.checked)}
            />
            גם למייל
          </label>
        ) : null}
      </div>
      {pushToast ? (
        <button
          type="button"
          role="status"
          className="text-xs font-bold text-slate-700 bg-white border border-slate-200 shadow-lg rounded-xl px-3 py-2 max-w-xs text-right"
          onClick={() => {
            const path = notifications.lastForegroundMessage?.data?.clickAction || '/sessions';
            if (typeof path === 'string') {
              window.location.assign(path);
            }
            setPushToast(null);
          }}
        >
          {pushToast}
        </button>
      ) : null}
    </div>
  );
};

export default RepPushNotifications;

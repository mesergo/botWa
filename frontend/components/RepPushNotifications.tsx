/**
 * Push notifications panel for any authenticated user on SessionsPage.
 * Never asks for userId/tenantId — Backend derives them from the JWT.
 */

import React, { useMemo, useState } from 'react';
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

  return (
    <div className="flex flex-col items-end gap-1">
      <EnableNotificationsButton notifications={notifications} showTestButton />
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

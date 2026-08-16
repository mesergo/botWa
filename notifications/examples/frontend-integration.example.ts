/**
 * EXAMPLE ONLY — not imported by the host frontend.
 *
 * Shows how a future agent screen would enable Chrome push notifications.
 * Do not mount EnableNotificationsButton in any existing page yet.
 */

/*
Suggested future usage (DO NOT APPLY YET):

  import {
    createDeviceRegistrationService,
    usePushNotifications,
    EnableNotificationsButton,
  } from '../../notifications/frontend';

  const deviceService = createDeviceRegistrationService({
    apiBaseUrl: `${API_BASE}/push-notifications`,
    getAccessToken: () => localStorage.getItem('token'),
  });

  function AgentNotificationsSettings() {
    const notifications = usePushNotifications({
      deviceService,
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_PUBLIC_KEY,
      getServiceWorkerRegistration: async () => {
        if (!('serviceWorker' in navigator)) return undefined;
        return navigator.serviceWorker.register('/firebase-messaging-sw.js');
      },
      onForegroundMessage: (msg) => {
        // Optional: toast / in-app banner using msg.data.conversationId
        console.log('foreground push', msg);
      },
    });

    return <EnableNotificationsButton notifications={notifications} />;
  }
*/

export const frontendIntegrationNotes = {
  buttonComponent: 'EnableNotificationsButton',
  hook: 'usePushNotifications',
  permissionRule: 'Request Notification permission only after explicit user click',
  serviceWorkerTarget: 'frontend/public/firebase-messaging-sw.js',
  serviceWorkerSource: 'notifications/service-worker/firebase-messaging-sw.example.js',
  suggestedUiLocation: 'SessionsPage / agent settings area for role=rep',
} as const;

/**
 * EXAMPLE Firebase Messaging Service Worker
 * -----------------------------------------
 * This file is NOT copied to the host `frontend/public` folder yet.
 *
 * During integration, copy (and rename) to:
 *   frontend/public/firebase-messaging-sw.js
 *
 * Then replace the placeholder config values below with the same public
 * Firebase web config used by the client (API key, project id, etc.).
 * NEVER put Firebase Admin private keys in a service worker.
 *
 * Background messages are handled here; foreground messages are handled
 * by the React app via onMessage.
 */

/* eslint-disable no-undef */
// Scripts loaded in the service worker scope:
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_FIREBASE_AUTH_DOMAIN',
  projectId: 'REPLACE_WITH_FIREBASE_PROJECT_ID',
  messagingSenderId: 'REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_FIREBASE_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'הודעה חדשה';
  const options = {
    body: payload.notification?.body || '',
    data: payload.data || {},
    // Keep payload minimal — identifiers + short preview only
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetPath =
    data.clickAction ||
    (data.conversationId
      ? `/sessions?conversationId=${encodeURIComponent(data.conversationId)}`
      : '/sessions');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate?.(targetPath);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetPath);
      }
      return undefined;
    })
  );
});

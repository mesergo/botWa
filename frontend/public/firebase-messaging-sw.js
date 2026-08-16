/**
 * Firebase Messaging Service Worker (FID / FCM web).
 * Public config only — never Admin credentials.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBBjwyaD_DTCFYs2VScwfkoN8PAdrWrnYs',
  authDomain: 'bots-84f5b.firebaseapp.com',
  projectId: 'bots-84f5b',
  storageBucket: 'bots-84f5b.firebasestorage.app',
  messagingSenderId: '407562604775',
  appId: '1:407562604775:web:6ba991c3e92c7f8c491242',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // If FCM already included a notification payload, the browser displays it
  // automatically — do not call showNotification again (prevents duplicates).
  // Tag/renotify from FCM webpush.notification will update the same conversation card.
  if (payload.notification) {
    return;
  }

  const title = payload.data?.title || 'לקוח ממתין לטיפול';
  const tag = payload.data?.tag || (payload.data?.conversationId ? `conversation:${payload.data.conversationId}` : undefined);
  const options = {
    body: payload.data?.body || '',
    data: payload.data || {},
    ...(tag ? { tag, renotify: true } : {}),
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
      : data.phone
        ? `/sessions?phone=${encodeURIComponent(data.phone)}`
        : '/sessions');

  const absoluteUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (typeof client.navigate === 'function') {
            return client.navigate(absoluteUrl).then((c) => (c && c.focus ? c.focus() : client.focus()));
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
      return undefined;
    })
  );
});

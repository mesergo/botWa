/**
 * FID registration (register + onRegistered) and foreground onMessage.
 */

import { initFirebaseClient, getMessagingInstance } from '../firebase/firebaseClient';
import type { ForegroundMessageHandler, ForegroundPushMessage, FirebaseWebConfig } from '../types';

/**
 * Register this browser with FCM via FID APIs.
 * Returns the Firebase Installation ID delivered by onRegistered.
 */
export async function registerForPush(
  vapidKey: string,
  serviceWorkerRegistration?: ServiceWorkerRegistration,
  config?: FirebaseWebConfig
): Promise<string> {
  if (!vapidKey) {
    throw new Error('VAPID public key is required (VITE_FIREBASE_VAPID_PUBLIC_KEY)');
  }

  await initFirebaseClient(config);
  const messaging = getMessagingInstance();
  if (!messaging) {
    throw new Error('Firebase messaging is not initialized');
  }

  const { register, onRegistered } = await import('firebase/messaging');

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        unsubscribe();
        reject(new Error('Timed out waiting for Firebase Installation ID (onRegistered)'));
      }
    }, 30000);

    const unsubscribe = onRegistered(messaging as never, (installationId: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      if (!installationId) {
        reject(new Error('Empty Firebase Installation ID'));
        return;
      }
      resolve(installationId);
    });

    register(messaging as never, {
      vapidKey,
      serviceWorkerRegistration,
    }).catch((err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/**
 * Subscribe to foreground messages via onMessage.
 */
export async function subscribeToForegroundMessages(
  handler: ForegroundMessageHandler,
  config?: FirebaseWebConfig
): Promise<() => void> {
  await initFirebaseClient(config);
  const messaging = getMessagingInstance();
  if (!messaging) {
    throw new Error('Firebase messaging is not initialized');
  }

  const { onMessage } = await import('firebase/messaging');
  return onMessage(messaging as never, (payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }) => {
    const message: ForegroundPushMessage = {
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data || {},
    };
    handler(message);
  });
}

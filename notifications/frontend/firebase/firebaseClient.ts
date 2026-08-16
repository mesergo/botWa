/**
 * Firebase Client bootstrap for FCM (Chrome / web) — FID APIs.
 */

import type { FirebaseWebConfig } from '../types';

let appInstance: unknown = null;
let messagingInstance: unknown = null;

export function getFirebaseWebConfigFromEnv(
  env: Record<string, string | undefined> = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {}
): FirebaseWebConfig {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID;
  const messagingSenderId =
    env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID;
  const appId = env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID;
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET;

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    throw new Error(
      'Missing Firebase web config. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID'
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    messagingSenderId,
    appId,
    storageBucket,
  };
}

export async function initFirebaseClient(config?: FirebaseWebConfig): Promise<{
  app: unknown;
  messaging: unknown;
}> {
  if (typeof window === 'undefined') {
    throw new Error('Firebase client can only be initialized in the browser');
  }

  if (appInstance && messagingInstance) {
    return { app: appInstance, messaging: messagingInstance };
  }

  const resolved = config || getFirebaseWebConfigFromEnv();
  const { initializeApp, getApps } = await import('firebase/app');
  const { getMessaging, isSupported } = await import('firebase/messaging');

  const supported = await isSupported();
  if (!supported) {
    throw new Error('Firebase Messaging is not supported in this browser');
  }

  const existing = getApps();
  const app = existing.length ? existing[0] : initializeApp(resolved);
  const messaging = getMessaging(app);

  appInstance = app;
  messagingInstance = messaging;
  return { app, messaging };
}

export function getMessagingInstance(): unknown | null {
  return messagingInstance;
}

export function __resetFirebaseClientForTests(): void {
  appInstance = null;
  messagingInstance = null;
}

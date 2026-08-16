/**
 * Firebase Admin bootstrap using backend environment variables only.
 * No Service Account file is read at runtime.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let messaging = null;
let initialized = false;
let initError = null;
let initAttempted = false;

/**
 * Initialize Firebase Admin exactly once.
 * Returns a non-throwing status so missing configuration does not stop the server.
 */
export async function initFirebaseAdmin() {
  if (initialized && messaging) {
    return { messaging, ready: true };
  }
  if (initAttempted && initError) {
    return { messaging: null, ready: false };
  }

  initAttempted = true;

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Missing Firebase Admin environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY'
      );
    }

    const firebaseAdminApp =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

    messaging = getMessaging(firebaseAdminApp);
    initialized = true;
    initError = null;
    console.log('[notifications] Firebase Admin initialized');
    return { messaging, ready: true };
  } catch (err) {
    initError = err instanceof Error ? err : new Error(String(err));
    console.error('[notifications] Firebase Admin init failed (server continues):', initError.message);
    return { messaging: null, ready: false };
  }
}

export function isFirebaseAdminReady() {
  return Boolean(initialized && messaging);
}

export function getFirebaseAdminInitError() {
  return initError;
}

export function __resetFirebaseAdminForTests() {
  messaging = null;
  initialized = false;
  initError = null;
  initAttempted = false;
}

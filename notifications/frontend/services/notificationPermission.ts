/**
 * Browser Notification permission helpers.
 * Permission must ONLY be requested after an explicit user gesture
 * (e.g. clicking EnableNotificationsButton).
 */

import type { NotificationPermissionState } from '../types';

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission. Call only from a user-initiated action.
 * @returns The resulting permission state
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const result = await Notification.requestPermission();
  return result;
}

export function isNotificationPermissionGranted(): boolean {
  return getNotificationPermissionState() === 'granted';
}

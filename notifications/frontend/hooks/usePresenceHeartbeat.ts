/**
 * Presence heartbeat — tells the backend the user has the system open in a browser.
 * Mounted once at the app root so every page counts. The backend treats a user with no
 * heartbeat for a few minutes as "not connected" (offline email alert) and re-arms the
 * one-time offline alert on each heartbeat.
 */

import { useEffect } from 'react';

const HEARTBEAT_MS = 60 * 1000;

export function usePresenceHeartbeat(apiBaseUrl: string, token: string | null | undefined): void {
  useEffect(() => {
    if (!token) return;
    const url = `${apiBaseUrl.replace(/\/$/, '')}/push-notifications/presence`;

    const beat = () => {
      fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };

    beat();
    const interval = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', beat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', beat);
    };
  }, [apiBaseUrl, token]);
}

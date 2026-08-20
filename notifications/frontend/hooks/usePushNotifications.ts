/**
 * React hook for Chrome push notifications (FID + bot-line preferences).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
} from '../services/notificationPermission';
import { registerForPush, subscribeToForegroundMessages } from '../services/foregroundMessaging';
import type { DeviceRegistrationService } from '../services/deviceRegistrationService';
import type {
  BotLineOption,
  ForegroundMessageHandler,
  ForegroundPushMessage,
  NotificationPermissionState,
  FirebaseWebConfig,
} from '../types';

const PUSH_STATE_STORAGE_KEY = 'mesergo.pushNotifications';

type StoredPushState = {
  fid: string;
  allBotLines: boolean;
  selectedBotLineIds: string[];
};

function readStoredPushState(): StoredPushState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PUSH_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPushState>;
    if (typeof parsed.fid !== 'string' || parsed.fid.length < 8) return null;
    return {
      fid: parsed.fid,
      allBotLines: parsed.allBotLines !== false,
      selectedBotLineIds: Array.isArray(parsed.selectedBotLineIds)
        ? parsed.selectedBotLineIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

function writeStoredPushState(state: StoredPushState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PUSH_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

function clearStoredPushState(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PUSH_STATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface UsePushNotificationsOptions {
  deviceService: DeviceRegistrationService;
  vapidKey: string;
  firebaseConfig?: FirebaseWebConfig;
  onForegroundMessage?: ForegroundMessageHandler;
  getServiceWorkerRegistration?: () => Promise<ServiceWorkerRegistration | undefined>;
}

export interface UsePushNotificationsResult {
  permission: NotificationPermissionState;
  enabled: boolean;
  loading: boolean;
  error: string | null;
  fid: string | null;
  botLines: BotLineOption[];
  allBotLines: boolean;
  selectedBotLineIds: string[];
  setAllBotLines: (value: boolean) => void;
  toggleBotLine: (id: string) => void;
  lastForegroundMessage: ForegroundPushMessage | null;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
  sendTestNotification: () => Promise<boolean>;
  refreshBotLines: () => Promise<void>;
}

export function usePushNotifications(options: UsePushNotificationsOptions): UsePushNotificationsResult {
  const storedOnInit = readStoredPushState();
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermissionState()
  );
  const [enabled, setEnabled] = useState(
    () => getNotificationPermissionState() === 'granted' && !!storedOnInit?.fid
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fid, setFid] = useState<string | null>(() =>
    getNotificationPermissionState() === 'granted' ? storedOnInit?.fid ?? null : null
  );
  const [botLines, setBotLines] = useState<BotLineOption[]>([]);
  const [allBotLines, setAllBotLines] = useState(() => storedOnInit?.allBotLines ?? true);
  const [selectedBotLineIds, setSelectedBotLineIds] = useState<string[]>(
    () => storedOnInit?.selectedBotLineIds ?? []
  );
  const [lastForegroundMessage, setLastForegroundMessage] = useState<ForegroundPushMessage | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refreshBotLines = useCallback(async () => {
    try {
      const lines = await optionsRef.current.deviceService.listBotLines();
      setBotLines(lines);
      if (lines.length === 1) {
        setSelectedBotLineIds((prev) => (prev.length ? prev : [lines[0].id]));
      }
    } catch (err) {
      // Non-fatal — registration can still use allBotLines
      console.warn('[notifications] failed to load bot lines:', err);
    }
  }, []);

  useEffect(() => {
    void refreshBotLines();

    const opts = optionsRef.current;
    const stored = readStoredPushState();
    const perm = getNotificationPermissionState();
    setPermission(perm);

    let cancelled = false;

    const restore = async () => {
      if (perm !== 'granted') return;

      try {
        let restoredFid = stored?.fid || null;
        let restoredAllBotLines = stored?.allBotLines ?? true;
        let restoredBotLineIds = stored?.selectedBotLineIds ?? [];

        // First return after enable (or cleared storage): refresh FID once and persist.
        // Later visits: reuse stored FID — do not re-register every navigation.
        if (!restoredFid && opts.vapidKey) {
          const swReg = await opts.getServiceWorkerRegistration?.();
          if (cancelled) return;
          const installationId = await registerForPush(opts.vapidKey, swReg, opts.firebaseConfig);
          if (cancelled) return;
          restoredFid = installationId;

          await opts.deviceService.register({
            fid: installationId,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            platform: 'web',
            allBotLines: restoredAllBotLines,
            botLineIds: restoredAllBotLines ? [] : restoredBotLineIds,
          });
          if (cancelled) return;

          writeStoredPushState({
            fid: installationId,
            allBotLines: restoredAllBotLines,
            selectedBotLineIds: restoredAllBotLines ? [] : restoredBotLineIds,
          });
        } else if (restoredFid) {
          await opts.getServiceWorkerRegistration?.();
        }

        if (!restoredFid || cancelled) return;

        setFid(restoredFid);
        setAllBotLines(restoredAllBotLines);
        setSelectedBotLineIds(restoredBotLineIds);
        setEnabled(true);

        unsubRef.current?.();
        unsubRef.current = await subscribeToForegroundMessages((message) => {
          setLastForegroundMessage(message);
          optionsRef.current.onForegroundMessage?.(message);
        }, opts.firebaseConfig);
      } catch (err) {
        console.warn('[notifications] failed to restore push subscription:', err);
      }
    };

    void restore();

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [refreshBotLines]);

  const toggleBotLine = useCallback((id: string) => {
    setSelectedBotLineIds((prev: string[]) =>
      prev.includes(id) ? prev.filter((x: string) => x !== id) : [...prev, id]
    );
  }, []);

  const enableNotifications = useCallback(async () => {
    const opts = optionsRef.current;
    setLoading(true);
    setError(null);
    try {
      if (!opts.vapidKey) {
        setError('חסר מפתח VAPID (VITE_FIREBASE_VAPID_PUBLIC_KEY)');
        return false;
      }

      const nextPermission = await requestNotificationPermission();
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        setEnabled(false);
        clearStoredPushState();
        setError(
          nextPermission === 'denied'
            ? 'ההרשאה להתראות נחסמה. יש לאפשר אותה בהגדרות הדפדפן.'
            : 'הדפדפן אינו תומך בהתראות Push'
        );
        return false;
      }

      if (!allBotLines && selectedBotLineIds.length === 0) {
        setError('יש לבחור לפחות קו בוט אחד, או לסמן "כל הקווים"');
        return false;
      }

      const swReg = opts.getServiceWorkerRegistration
        ? await opts.getServiceWorkerRegistration()
        : undefined;

      const installationId = await registerForPush(opts.vapidKey, swReg, opts.firebaseConfig);
      await opts.deviceService.register({
        fid: installationId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        platform: 'web',
        allBotLines,
        botLineIds: allBotLines ? [] : selectedBotLineIds,
      });

      writeStoredPushState({
        fid: installationId,
        allBotLines,
        selectedBotLineIds: allBotLines ? [] : selectedBotLineIds,
      });

      setFid(installationId);
      setEnabled(true);

      unsubRef.current?.();
      unsubRef.current = await subscribeToForegroundMessages((message) => {
        setLastForegroundMessage(message);
        opts.onForegroundMessage?.(message);
      }, opts.firebaseConfig);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setEnabled(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [allBotLines, selectedBotLineIds]);

  const disableNotifications = useCallback(async () => {
    const opts = optionsRef.current;
    setLoading(true);
    setError(null);
    try {
      if (fid) {
        await opts.deviceService.unregister(fid);
      }
      unsubRef.current?.();
      unsubRef.current = null;
      clearStoredPushState();
      setFid(null);
      setEnabled(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fid]);

  const sendTestNotification = useCallback(async () => {
    const opts = optionsRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await opts.deviceService.sendTest();
      if (!result.success) {
        setError(result.reason || 'שליחת בדיקה נכשלה');
        return false;
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    permission,
    enabled,
    loading,
    error,
    fid,
    botLines,
    allBotLines,
    selectedBotLineIds,
    setAllBotLines,
    toggleBotLine,
    lastForegroundMessage,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    refreshBotLines,
  };
}

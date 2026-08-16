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
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermissionState()
  );
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fid, setFid] = useState<string | null>(null);
  const [botLines, setBotLines] = useState<BotLineOption[]>([]);
  const [allBotLines, setAllBotLines] = useState(true);
  const [selectedBotLineIds, setSelectedBotLineIds] = useState<string[]>([]);
  const [lastForegroundMessage, setLastForegroundMessage] = useState<ForegroundPushMessage | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refreshBotLines = useCallback(async () => {
    try {
      const lines = await optionsRef.current.deviceService.listBotLines();
      setBotLines(lines);
      if (lines.length === 1) {
        setSelectedBotLineIds([lines[0].id]);
      }
    } catch (err) {
      // Non-fatal — registration can still use allBotLines
      console.warn('[notifications] failed to load bot lines:', err);
    }
  }, []);

  useEffect(() => {
    void refreshBotLines();
    return () => {
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

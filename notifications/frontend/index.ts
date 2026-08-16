/**
 * Push notifications frontend module — public entry point (FID-based).
 */

export type {
  NotificationPermissionState,
  FirebaseWebConfig,
  BotLineOption,
  RegisterDeviceRequest,
  PushMessageData,
  ForegroundPushMessage,
  ForegroundMessageHandler,
} from './types';

export {
  initFirebaseClient,
  getFirebaseWebConfigFromEnv,
  getMessagingInstance,
} from './firebase/firebaseClient';

export {
  getNotificationPermissionState,
  requestNotificationPermission,
  isNotificationPermissionGranted,
} from './services/notificationPermission';

export {
  createDeviceRegistrationService,
} from './services/deviceRegistrationService';
export type {
  DeviceRegistrationService,
  DeviceRegistrationServiceOptions,
} from './services/deviceRegistrationService';

export {
  registerForPush,
  subscribeToForegroundMessages,
} from './services/foregroundMessaging';

export {
  usePushNotifications,
} from './hooks/usePushNotifications';
export type {
  UsePushNotificationsOptions,
  UsePushNotificationsResult,
} from './hooks/usePushNotifications';

export {
  EnableNotificationsButton,
} from './components/EnableNotificationsButton';
export type { EnableNotificationsButtonProps } from './components/EnableNotificationsButton';

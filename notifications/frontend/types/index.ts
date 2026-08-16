/**
 * Frontend types for FID-based push notifications.
 */

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  storageBucket?: string;
}

export interface BotLineOption {
  id: string;
  name: string;
  displayPhone?: string;
}

export interface RegisterDeviceRequest {
  fid: string;
  userAgent?: string;
  platform?: string;
  allBotLines?: boolean;
  botLineIds?: string[];
}

export interface PushMessageData {
  eventId?: string;
  tenantId?: string;
  botLineId?: string;
  conversationId?: string;
  messageId?: string;
  clickAction?: string;
  tag?: string;
  [key: string]: string | undefined;
}

export interface ForegroundPushMessage {
  title?: string;
  body?: string;
  data: PushMessageData;
}

export type ForegroundMessageHandler = (message: ForegroundPushMessage) => void;

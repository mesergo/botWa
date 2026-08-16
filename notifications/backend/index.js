/**
 * Push notifications backend module — public entry point (FID + tenant bot lines).
 */

import { FirebaseNotificationProvider } from './infrastructure/firebase/FirebaseNotificationProvider.js';
import { DefaultRecipientResolver } from './application/RecipientResolver.js';
import { MongooseDeviceRegistrationRepository } from './infrastructure/repositories/MongooseDeviceRegistrationRepository.js';
import { NotificationService } from './application/NotificationService.js';
import { InMemoryEventDeduplicator } from './infrastructure/deduplication/InMemoryEventDeduplicator.js';
import { createPushNotificationRouter } from './api/deviceRegistration.routes.js';
import { initFirebaseAdmin } from './infrastructure/firebase/firebaseAdmin.js';
import { ensurePushDeviceRegistrationIndexes } from './infrastructure/migrations/001_push_device_registrations.js';

export { RECIPIENT_TYPES, MAX_PREVIEW_LENGTH } from './types/index.js';

export {
  createWaitingCustomerMessageEvent,
  createConversationMessageReceivedEvent,
  sanitizePreviewText,
  buildWaitingCustomerPushPayload,
  buildPushPayloadFromEvent,
} from './domain/events.js';
export { NotificationModuleError, ValidationError, UnauthorizedError } from './domain/errors.js';
export { createRecipient, isValidRecipientType } from './domain/recipients.js';

export { NotificationProvider } from './application/NotificationProvider.js';
export { NotificationService } from './application/NotificationService.js';
export { RecipientResolver, DefaultRecipientResolver } from './application/RecipientResolver.js';
export { DeviceRegistrationRepository } from './application/DeviceRegistrationRepository.js';

export { FirebaseNotificationProvider } from './infrastructure/firebase/FirebaseNotificationProvider.js';
export {
  initFirebaseAdmin,
  isFirebaseAdminReady,
  getFirebaseAdminInitError,
} from './infrastructure/firebase/firebaseAdmin.js';
export { InMemoryEventDeduplicator } from './infrastructure/deduplication/InMemoryEventDeduplicator.js';
export { InMemoryDeviceRegistrationRepository } from './infrastructure/repositories/InMemoryDeviceRegistrationRepository.js';
export { MongooseDeviceRegistrationRepository } from './infrastructure/repositories/MongooseDeviceRegistrationRepository.js';
export { getDeviceRegistrationModel, deviceRegistrationSchema } from './infrastructure/models/DeviceRegistration.model.js';
export { ensurePushDeviceRegistrationIndexes } from './infrastructure/migrations/001_push_device_registrations.js';

export { parseRegisterDeviceDto } from './api/dto.js';
export { createDeviceRegistrationController, resolveSessionIdentity } from './api/deviceRegistration.controller.js';
export { createPushNotificationRouter } from './api/deviceRegistration.routes.js';

/**
 * Wire a production-ready stack for the host Express app.
 * @param {{ authenticate: import('express').RequestHandler, logger?: any }} options
 */
export async function bootstrapPushNotifications(options) {
  const { authenticate, logger = console } = options;

  const adminResult = await initFirebaseAdmin();
  if (!adminResult.ready) {
    logger.warn?.(
      '[notifications] Continuing without Firebase Admin — registration API works; send/test requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY'
    );
  }

  try {
    await ensurePushDeviceRegistrationIndexes();
  } catch (err) {
    logger.error?.('[notifications] Failed to ensure indexes:', err?.message || err);
  }

  const deviceRepository = new MongooseDeviceRegistrationRepository();
  const notificationService = new NotificationService({
    provider: new FirebaseNotificationProvider(),
    recipientResolver: new DefaultRecipientResolver(),
    deviceRepository,
    deduplicator: new InMemoryEventDeduplicator(),
    logger,
  });

  const router = createPushNotificationRouter({
    notificationService,
    authenticate,
  });

  return { notificationService, router, firebaseReady: adminResult.ready };
}

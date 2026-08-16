/**
 * EXAMPLE ONLY — not imported by the host application.
 *
 * Illustrates how the existing Express backend would wire this module later.
 * Do not apply these changes yet — see REQUIRED_INTEGRATION_CHANGES.md.
 */

/*
Suggested future wiring in backend/server.js (DO NOT APPLY YET):

  import {
    createPushNotificationRouter,
    createStandaloneNotificationStack,
    MongooseDeviceRegistrationRepository,
    FirebaseNotificationProvider,
    DefaultRecipientResolver,
    NotificationService,
    InMemoryEventDeduplicator,
  } from '../notifications/backend/index.js';
  import { authenticateToken } from './middleware/auth.js';

  const deviceRepository = new MongooseDeviceRegistrationRepository();
  const notificationService = new NotificationService({
    provider: new FirebaseNotificationProvider(),
    recipientResolver: new DefaultRecipientResolver(),
    deviceRepository,
    deduplicator: new InMemoryEventDeduplicator(),
  });

  app.use(
    '/api/push-notifications',
    createPushNotificationRouter({
      notificationService,
      authenticate: authenticateToken,
    })
  );
*/

/*
Suggested future call site in chatController (DO NOT APPLY YET):

  import { notificationService } from '../path/to/wired/instance.js';

  // After message is saved and eventBus.emit('session:update', ...) fires:
  void notificationService.handleConversationMessageReceived({
    eventId: `msg_${savedMessageId}`,
    tenantId: String(accountOwnerId),
    conversationId: String(sessionId),
    messageId: String(savedMessageId),
    assignedAgentId: assignedAgentId ? String(assignedAgentId) : null,
    senderDisplayName: contactDisplayName || 'לקוח',
    createdAt: new Date().toISOString(),
    previewText: shortPreview, // truncated — never full body
  });
*/

export const backendIntegrationNotes = {
  mountPath: '/api/push-notifications',
  registerPath: 'POST /api/push-notifications/devices/register',
  unregisterPath: 'POST /api/push-notifications/devices/unregister',
  auth: 'authenticateToken from backend/middleware/auth.js',
  identity: 'userId/tenantId from JWT session only — never from request body',
  eventHook: 'backend/controllers/chatController.js near eventBus.emit(session:update)',
} as const;

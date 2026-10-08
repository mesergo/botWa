/**
 * Holds the live NotificationService instance for chatController hooks.
 * Set once during server bootstrap — never imported before DB connect.
 */

let _service = null;

/**
 * @param {import('../../notifications/backend/application/NotificationService.js').NotificationService|null} service
 */
export function setPushNotificationService(service) {
  _service = service;
}

export function getPushNotificationService() {
  return _service;
}

/**
 * Fire-and-forget waiting-customer push. Never throws.
 * @param {object} event
 */
export function notifyWaitingCustomerMessage(event) {
  const service = _service;
  if (!service) return;
  try {
    void service.handleWaitingCustomerMessage(event).then((result) => {
      if (result && result.skipped) return;
      if (result && !result.success) {
        console.warn('[notifications] waiting-customer push failed:', result.reason || result.error);
      }
    }).catch((err) => {
      console.error('[notifications] waiting-customer push isolated error:', err?.message || err);
    });
  } catch (err) {
    console.error('[notifications] waiting-customer push isolated error:', err?.message || err);
  }
}

/**
 * Fire-and-forget "offline" email alert (one email per offline period). Never throws.
 * Skips simulator conversations.
 * @param {{ tenantId: string, sessionId: string, customerName?: string, customerPhone?: string,
 *   previewText?: string, clickAction?: string, isNewConversation?: boolean }} event
 */
export function notifyOfflineAlert(event) {
  const phone = String(event?.customerPhone || '');
  if (!phone || phone === 'Simulated' || phone.toLowerCase() === 'simulator') return;
  void import('../../notifications/backend/infrastructure/email/offlineAlertNotifier.js')
    .then(({ notifyOfflineUsers }) => notifyOfflineUsers(event))
    .catch((err) => console.error('[notifications] offline alert isolated error:', err?.message || err));
}

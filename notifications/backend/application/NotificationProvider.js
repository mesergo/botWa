/**
 * @interface
 */
export class NotificationProvider {
  /**
   * @param {string[]} fids
   * @param {import('../types/index.js').PushNotificationPayload} payload
   * @returns {Promise<import('../types/index.js').NotificationSendResult>}
   */
  async sendToFids(_fids, _payload) {
    throw new Error('NotificationProvider.sendToFids must be implemented');
  }
}

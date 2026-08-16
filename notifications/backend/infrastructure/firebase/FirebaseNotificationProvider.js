/**
 * FirebaseNotificationProvider — FCM delivery by Firebase Installation ID (FID).
 * Uses fid / fids only — never legacy registration tokens.
 */

import { NotificationProvider } from '../../application/NotificationProvider.js';
import { initFirebaseAdmin, isFirebaseAdminReady } from './firebaseAdmin.js';

const INVALID_FID_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/installation-id-not-registered',
]);

export class FirebaseNotificationProvider extends NotificationProvider {
  /**
   * @param {{ messaging?: any }} [deps]
   */
  constructor(deps = {}) {
    super();
    this._messaging = deps.messaging || null;
  }

  async _getMessaging() {
    if (this._messaging) return this._messaging;
    const { messaging, ready } = await initFirebaseAdmin();
    if (!ready || !messaging) {
      throw new Error('Firebase Admin is not ready');
    }
    this._messaging = messaging;
    return messaging;
  }

  /**
   * @param {string[]} fids
   * @param {import('../../types/index.js').PushNotificationPayload} payload
   * @returns {Promise<import('../../types/index.js').NotificationSendResult>}
   */
  async sendToFids(fids, payload) {
    const uniqueFids = [...new Set((fids || []).filter(Boolean))];
    if (!uniqueFids.length) {
      return { success: true, skipped: true, reason: 'no_fids', sentCount: 0, failedCount: 0, invalidFids: [] };
    }
    if (!payload?.title || !payload?.data?.eventId) {
      return {
        success: false,
        skipped: false,
        reason: 'invalid_payload',
        sentCount: 0,
        failedCount: uniqueFids.length,
        invalidFids: [],
        error: 'Payload must include title and data.eventId',
      };
    }

    try {
      if (!isFirebaseAdminReady() && !this._messaging) {
        await this._getMessaging();
      }
      const messaging = await this._getMessaging();

      const data = Object.fromEntries(
        Object.entries(payload.data || {}).map(([k, v]) => [k, v == null ? '' : String(v)])
      );

      const clickAction = payload.data.clickAction || '/';
      const tag = payload.tag || payload.data?.tag || '';

      const messageBase = {
        notification: {
          title: payload.title,
          body: payload.body || '',
        },
        data,
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body || '',
            ...(tag ? { tag, renotify: true } : {}),
          },
          fcmOptions: { link: clickAction },
        },
      };

      /** @type {string[]} */
      const invalidFids = [];
      let sentCount = 0;
      let failedCount = 0;

      if (uniqueFids.length === 1) {
        try {
          await messaging.send({
            fid: uniqueFids[0],
            ...messageBase,
          });
          sentCount = 1;
        } catch (err) {
          failedCount = 1;
          const code = err?.code || err?.errorInfo?.code;
          if (code && INVALID_FID_CODES.has(code)) {
            invalidFids.push(uniqueFids[0]);
          }
          return {
            success: false,
            skipped: false,
            reason: 'provider_error',
            sentCount: 0,
            failedCount: 1,
            invalidFids,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      } else {
        const response = await messaging.sendEachForMulticast({
          fids: uniqueFids,
          ...messageBase,
        });

        response.responses.forEach((res, index) => {
          if (res.success) {
            sentCount += 1;
            return;
          }
          failedCount += 1;
          const code = res.error?.code;
          if (code && INVALID_FID_CODES.has(code)) {
            invalidFids.push(uniqueFids[index]);
          }
        });
      }

      return {
        success: failedCount === 0,
        skipped: false,
        sentCount,
        failedCount,
        invalidFids,
      };
    } catch (err) {
      return {
        success: false,
        skipped: false,
        reason: 'provider_error',
        sentCount: 0,
        failedCount: uniqueFids.length,
        invalidFids: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * @deprecated Use sendToFids — kept for interface compatibility during transition.
   */
  async sendToTokens(tokens, payload) {
    return this.sendToFids(tokens, payload);
  }
}

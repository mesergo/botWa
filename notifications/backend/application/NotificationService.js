/**
 * NotificationService — waiting-customer push by tenant + bot line (FID).
 * Never throws into the bot message pipeline.
 */

import {
  createWaitingCustomerMessageEvent,
  buildWaitingCustomerPushPayload,
} from '../domain/events.js';
import { InMemoryEventDeduplicator } from '../infrastructure/deduplication/InMemoryEventDeduplicator.js';

export class NotificationService {
  /**
   * @param {object} deps
   * @param {import('./NotificationProvider.js').NotificationProvider} deps.provider
   * @param {import('./DeviceRegistrationRepository.js').DeviceRegistrationRepository} deps.deviceRepository
   * @param {import('./RecipientResolver.js').RecipientResolver} [deps.recipientResolver]
   * @param {{ tryClaim: (eventId: string) => boolean }} [deps.deduplicator]
   * @param {{ info?: Function, warn?: Function, error?: Function }} [deps.logger]
   */
  constructor(deps) {
    if (!deps?.provider || !deps?.deviceRepository) {
      throw new Error('NotificationService requires provider and deviceRepository');
    }
    this.provider = deps.provider;
    this.deviceRepository = deps.deviceRepository;
    this.recipientResolver = deps.recipientResolver || null;
    this.deduplicator = deps.deduplicator || new InMemoryEventDeduplicator();
    this.logger = deps.logger || console;
  }

  /**
   * Primary business trigger: customer message while conversation awaits human.
   * Recipients = enabled FIDs for the SAME tenant subscribed to the bot line.
   * Does NOT require assignedAgentId.
   *
   * @param {Partial<import('../types/index.js').WaitingCustomerMessageEvent>} rawEvent
   * @returns {Promise<import('../types/index.js').NotificationSendResult>}
   */
  async handleWaitingCustomerMessage(rawEvent) {
    try {
      const parsed = createWaitingCustomerMessageEvent(rawEvent);
      if (!parsed.ok) {
        this.logger.warn?.('[notifications] invalid waiting-customer event:', parsed.error);
        return { success: false, skipped: true, reason: 'invalid_event', error: parsed.error };
      }

      const { event } = parsed;

      if (!this.deduplicator.tryClaim(event.eventId)) {
        this.logger.info?.('[notifications] duplicate event skipped:', event.eventId);
        return { success: true, skipped: true, reason: 'duplicate_event' };
      }

      const devices = await this.deviceRepository.findEnabledByTenantAndBotLine({
        tenantId: event.tenantId,
        botLineId: event.botLineId,
      });

      const fids = [...new Set(devices.map((d) => d.fid).filter(Boolean))];
      if (!fids.length) {
        return { success: true, skipped: true, reason: 'no_device_fids' };
      }

      const payload = buildWaitingCustomerPushPayload(event);
      const result = await this.provider.sendToFids(fids, payload);

      if (result.invalidFids?.length) {
        try {
          await this.deviceRepository.deactivateFids(result.invalidFids);
        } catch (cleanupErr) {
          this.logger.warn?.('[notifications] failed to deactivate invalid FIDs:', cleanupErr);
        }
      }

      if (!result.success) {
        this.logger.warn?.('[notifications] send partially/fully failed:', result);
      }

      return result;
    } catch (err) {
      this.logger.error?.('[notifications] unexpected error (isolated):', err);
      return {
        success: false,
        skipped: false,
        reason: 'unexpected_error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Alias for integration examples / older call sites */
  async handleConversationMessageReceived(rawEvent) {
    return this.handleWaitingCustomerMessage(rawEvent);
  }

  /**
   * @param {{ userId: string, tenantId: string }} identity
   */
  async sendTestToUser(identity) {
    try {
      const devices = await this.deviceRepository.findEnabledByUser({
        userId: identity.userId,
        tenantId: identity.tenantId,
      });
      const fids = devices.map((d) => d.fid).filter(Boolean);
      if (!fids.length) {
        return { success: false, skipped: true, reason: 'no_device_fids', sentCount: 0, failedCount: 0 };
      }

      const payload = {
        title: 'בדיקת התראות',
        body: 'התראת Chrome עובדת ✓',
        tag: `test:${identity.userId}`,
        data: {
          eventId: `test_${Date.now()}`,
          tenantId: identity.tenantId,
          botLineId: '',
          conversationId: '',
          messageId: '',
          clickAction: '/sessions',
          tag: `test:${identity.userId}`,
        },
      };

      const result = await this.provider.sendToFids(fids, payload);
      if (result.invalidFids?.length) {
        await this.deviceRepository.deactivateFids(result.invalidFids).catch(() => {});
      }
      return result;
    } catch (err) {
      this.logger.error?.('[notifications] test send error (isolated):', err);
      return {
        success: false,
        skipped: false,
        reason: 'unexpected_error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * @param {{
   *   userId: string,
   *   tenantId: string,
   *   fid: string,
   *   userAgent?: string,
   *   platform?: string,
   *   allBotLines?: boolean,
   *   botLineIds?: string[],
   * }} params
   */
  async registerDevice(params) {
    if (!params?.userId || !params?.tenantId || !params?.fid) {
      throw new Error('userId, tenantId, and fid are required');
    }
    return this.deviceRepository.upsert({
      userId: params.userId,
      tenantId: params.tenantId,
      fid: String(params.fid).trim(),
      userAgent: params.userAgent,
      platform: params.platform || 'web',
      allBotLines: params.allBotLines,
      botLineIds: params.botLineIds,
    });
  }

  /**
   * @param {{ userId: string, fid: string }} params
   */
  async unregisterDevice(params) {
    if (!params?.userId || !params?.fid) {
      throw new Error('userId and fid are required');
    }
    return this.deviceRepository.deactivateByFid({
      userId: params.userId,
      fid: String(params.fid).trim(),
    });
  }
}

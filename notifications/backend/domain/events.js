/**
 * Domain: waiting-customer event validation + safe FCM payload builder.
 */

import { MAX_PREVIEW_LENGTH } from '../types/index.js';

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {string} [text]
 * @returns {string}
 */
export function sanitizePreviewText(text) {
  if (!text || typeof text !== 'string') return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_PREVIEW_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_PREVIEW_LENGTH - 1)}…`;
}

/**
 * @param {Partial<import('../types/index.js').WaitingCustomerMessageEvent>} input
 * @returns {{ ok: true, event: import('../types/index.js').WaitingCustomerMessageEvent } | { ok: false, error: string }}
 */
export function createWaitingCustomerMessageEvent(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Event payload must be an object' };
  }

  const required = ['eventId', 'tenantId', 'botLineId', 'conversationId', 'messageId', 'createdAt'];
  for (const key of required) {
    if (!isNonEmptyString(input[key])) {
      return { ok: false, error: `Missing or invalid field: ${key}` };
    }
  }

  const preview = sanitizePreviewText(input.previewText);
  const conversationId = String(input.conversationId).trim();
  const clickAction =
    (isNonEmptyString(input.clickAction) && String(input.clickAction).trim()) ||
    `/sessions?conversationId=${encodeURIComponent(conversationId)}`;

  return {
    ok: true,
    event: {
      eventId: String(input.eventId).trim(),
      tenantId: String(input.tenantId).trim(),
      botLineId: String(input.botLineId).trim(),
      conversationId,
      messageId: String(input.messageId).trim(),
      senderDisplayName: isNonEmptyString(input.senderDisplayName)
        ? String(input.senderDisplayName).trim().slice(0, 120)
        : 'לקוח',
      createdAt: String(input.createdAt).trim(),
      previewText: preview,
      clickAction,
    },
  };
}

/**
 * @param {import('../types/index.js').WaitingCustomerMessageEvent} event
 * @returns {import('../types/index.js').PushNotificationPayload}
 */
export function buildWaitingCustomerPushPayload(event) {
  const tag = `conversation:${event.conversationId}`;
  const bodyParts = [
    event.senderDisplayName || 'לקוח',
    event.previewText ? `— ${event.previewText}` : 'ממתין למענה',
  ];
  return {
    title: 'לקוח ממתין לטיפול',
    body: bodyParts.join(' ').slice(0, 160),
    tag,
    data: {
      eventId: event.eventId,
      tenantId: event.tenantId,
      botLineId: event.botLineId,
      conversationId: event.conversationId,
      messageId: event.messageId,
      clickAction: event.clickAction || `/sessions?conversationId=${encodeURIComponent(event.conversationId)}`,
      tag,
    },
  };
}

/** @deprecated kept for older examples — prefer createWaitingCustomerMessageEvent */
export function createConversationMessageReceivedEvent(input) {
  return createWaitingCustomerMessageEvent({
    ...input,
    botLineId: input.botLineId || input.conversationId || 'unknown',
  });
}

/** @deprecated */
export function buildPushPayloadFromEvent(event) {
  return buildWaitingCustomerPushPayload({
    ...event,
    botLineId: event.botLineId || 'unknown',
  });
}

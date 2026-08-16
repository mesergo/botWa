/**
 * EXAMPLE ONLY — not imported by the host application.
 *
 * Shows how the bot / webhook layer should shape a ConversationMessageReceivedEvent
 * after a new inbound message is persisted.
 *
 * Suggested future hook point (do not change yet):
 *   backend/controllers/chatController.js
 *   near existing `eventBus.emit('session:update', ...)`
 */

import type { ConversationMessageReceivedEvent } from './types-shim';

/**
 * Local shim so this example type-checks conceptually without wiring the JS module.
 * In integration, import from the notifications backend entry instead.
 */
export type { ConversationMessageReceivedEvent };

/**
 * Build a safe event from a bot message context.
 * NEVER put the full message body into the event / FCM payload.
 */
export function buildExampleEvent(input: {
  tenantId: string;
  conversationId: string;
  messageId: string;
  assignedAgentId: string | null;
  senderDisplayName: string;
  rawMessageText?: string;
}): ConversationMessageReceivedEvent {
  const preview =
    input.rawMessageText && input.rawMessageText.length > 80
      ? `${input.rawMessageText.slice(0, 79)}…`
      : input.rawMessageText || '';

  return {
    eventId: `msg_${input.messageId}`,
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    assignedAgentId: input.assignedAgentId,
    senderDisplayName: input.senderDisplayName,
    createdAt: new Date().toISOString(),
    previewText: preview,
  };
}

// Illustrative usage (never executed by the host app):
export const exampleEvent: ConversationMessageReceivedEvent = buildExampleEvent({
  tenantId: 'TENANT_ID_FROM_SESSION_OWNER',
  conversationId: 'SESSION_OR_CONVERSATION_ID',
  messageId: 'MESSAGE_ID',
  assignedAgentId: 'ASSIGNED_AGENT_USER_ID',
  senderDisplayName: 'לקוח',
  rawMessageText: 'שלום, אשמח לעזרה עם ההזמנה שלי',
});

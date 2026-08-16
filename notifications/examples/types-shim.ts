/**
 * Lightweight type shim for example files only.
 * The runtime backend uses JSDoc typedefs in backend/types/index.js.
 */

export interface ConversationMessageReceivedEvent {
  eventId: string;
  tenantId: string;
  conversationId: string;
  messageId: string;
  assignedAgentId: string | null;
  senderDisplayName: string;
  createdAt: string;
  previewText?: string;
}

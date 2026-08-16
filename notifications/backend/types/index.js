/**
 * Shared type definitions for the push-notifications module (JSDoc).
 */

/**
 * @typedef {Object} DeviceRegistration
 * @property {string} id
 * @property {string} userId
 * @property {string} tenantId
 * @property {string} fid
 * @property {string} [userAgent]
 * @property {string} [platform]
 * @property {boolean} enabled
 * @property {boolean} allBotLines
 * @property {string[]} botLineIds
 * @property {Date|string} createdAt
 * @property {Date|string} updatedAt
 * @property {Date|string|null} [lastSeenAt]
 */

/**
 * Waiting-customer event for Chrome push.
 * @typedef {Object} WaitingCustomerMessageEvent
 * @property {string} eventId
 * @property {string} tenantId
 * @property {string} botLineId
 * @property {string} conversationId
 * @property {string} messageId
 * @property {string} [senderDisplayName]
 * @property {string} createdAt
 * @property {string} [previewText]
 * @property {string} [clickAction]
 */

/**
 * @typedef {Object} PushNotificationPayload
 * @property {string} title
 * @property {string} body
 * @property {string} [tag]
 * @property {Object} data
 * @property {string} data.eventId
 * @property {string} [data.tenantId]
 * @property {string} data.botLineId
 * @property {string} data.conversationId
 * @property {string} data.messageId
 * @property {string} [data.clickAction]
 * @property {string} [data.tag]
 */

/**
 * @typedef {Object} NotificationSendResult
 * @property {boolean} success
 * @property {boolean} skipped
 * @property {string} [reason]
 * @property {number} [sentCount]
 * @property {number} [failedCount]
 * @property {string[]} [invalidFids]
 * @property {Error|string} [error]
 */

/**
 * @typedef {Object} RegisterDeviceDto
 * @property {string} fid
 * @property {string} [userAgent]
 * @property {string} [platform]
 * @property {boolean} [allBotLines]
 * @property {string[]} [botLineIds]
 */

/**
 * @typedef {'agent' | 'ambassador' | 'manager'} RecipientType
 * @typedef {{ userId: string, tenantId: string, type: RecipientType }} NotificationRecipient
 */

export const RECIPIENT_TYPES = Object.freeze(['agent', 'ambassador', 'manager']);
export const MAX_PREVIEW_LENGTH = 80;

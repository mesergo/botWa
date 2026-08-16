/**
 * Domain helpers for notification recipients.
 * Planned recipient types: agent | ambassador | manager
 */

import { RECIPIENT_TYPES } from '../types/index.js';

/**
 * @param {string} type
 * @returns {type is import('../types/index.js').RecipientType}
 */
export function isValidRecipientType(type) {
  return RECIPIENT_TYPES.includes(type);
}

/**
 * @param {string} userId
 * @param {string} tenantId
 * @param {import('../types/index.js').RecipientType} type
 * @returns {import('../types/index.js').NotificationRecipient}
 */
export function createRecipient(userId, tenantId, type) {
  if (!userId || !tenantId) {
    throw new Error('userId and tenantId are required');
  }
  if (!isValidRecipientType(type)) {
    throw new Error(`Invalid recipient type: ${type}`);
  }
  return {
    userId: String(userId),
    tenantId: String(tenantId),
    type,
  };
}

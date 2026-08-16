/**
 * API DTOs — FID registration + bot-line preferences.
 * userId/tenantId NEVER accepted from client body.
 */

import { ValidationError } from '../domain/errors.js';

/**
 * @param {unknown} body
 * @returns {import('../types/index.js').RegisterDeviceDto}
 */
export function parseRegisterDeviceDto(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }
  const { fid, userAgent, platform, allBotLines, botLineIds } =
    /** @type {Record<string, unknown>} */ (body);

  if ('userId' in body || 'tenantId' in body || 'user_id' in body || 'tenant_id' in body || 'customerId' in body) {
    throw new ValidationError('userId/tenantId/customerId must not be supplied by the client');
  }

  if (typeof fid !== 'string' || fid.trim().length < 8) {
    throw new ValidationError('fid is required and must be a non-empty Firebase Installation ID');
  }

  const preferAll = allBotLines === undefined ? true : Boolean(allBotLines);
  let lines = [];
  if (!preferAll) {
    if (!Array.isArray(botLineIds)) {
      throw new ValidationError('botLineIds must be an array when allBotLines is false');
    }
    lines = [...new Set(botLineIds.map((id) => String(id).trim()).filter(Boolean))];
    if (!lines.length) {
      throw new ValidationError('Select at least one bot line, or enable allBotLines');
    }
  }

  return {
    fid: fid.trim(),
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : undefined,
    platform: typeof platform === 'string' ? platform.slice(0, 64) : undefined,
    allBotLines: preferAll,
    botLineIds: lines,
  };
}

/**
 * In-memory DeviceRegistrationRepository (FID + bot lines) — local testing only.
 */

import { DeviceRegistrationRepository } from '../../application/DeviceRegistrationRepository.js';

export class InMemoryDeviceRegistrationRepository extends DeviceRegistrationRepository {
  constructor() {
    super();
    /** @type {Map<string, import('../../types/index.js').DeviceRegistration>} */
    this._byFid = new Map();
  }

  async upsert(registration) {
    const now = new Date().toISOString();
    const existing = this._byFid.get(registration.fid);
    const allBotLines = registration.allBotLines !== false;
    /** @type {import('../../types/index.js').DeviceRegistration} */
    const record = {
      id: existing?.id || `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: registration.userId,
      tenantId: registration.tenantId,
      fid: registration.fid,
      userAgent: registration.userAgent,
      platform: registration.platform || 'web',
      enabled: true,
      allBotLines,
      botLineIds: allBotLines ? [] : [...new Set((registration.botLineIds || []).map(String))],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
    };
    this._byFid.set(registration.fid, record);
    return record;
  }

  async deactivateByFid(params) {
    const existing = this._byFid.get(params.fid);
    if (!existing || existing.userId !== params.userId) return false;
    existing.enabled = false;
    existing.updatedAt = new Date().toISOString();
    this._byFid.set(params.fid, existing);
    return true;
  }

  async findEnabledByUser(params) {
    return [...this._byFid.values()].filter((r) => {
      if (!r.enabled || r.userId !== params.userId) return false;
      if (params.tenantId && r.tenantId !== params.tenantId) return false;
      return true;
    });
  }

  async findEnabledByTenantAndBotLine(params) {
    const botLineId = String(params.botLineId);
    return [...this._byFid.values()].filter((r) => {
      if (!r.enabled || r.tenantId !== String(params.tenantId)) return false;
      if (r.allBotLines) return true;
      return (r.botLineIds || []).includes(botLineId);
    });
  }

  async deactivateFids(fids) {
    let count = 0;
    for (const fid of fids) {
      const existing = this._byFid.get(fid);
      if (!existing || existing.enabled === false) continue;
      existing.enabled = false;
      existing.updatedAt = new Date().toISOString();
      this._byFid.set(fid, existing);
      count += 1;
    }
    return count;
  }
}

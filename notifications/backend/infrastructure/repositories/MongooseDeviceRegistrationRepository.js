/**
 * Mongoose adapter for DeviceRegistrationRepository (FID + bot-line prefs).
 */

import { DeviceRegistrationRepository } from '../../application/DeviceRegistrationRepository.js';
import { getDeviceRegistrationModel } from '../models/DeviceRegistration.model.js';

/**
 * @param {any} doc
 * @returns {import('../../types/index.js').DeviceRegistration}
 */
function toRecord(doc) {
  return {
    id: String(doc._id),
    userId: doc.userId,
    tenantId: doc.tenantId,
    fid: doc.fid,
    userAgent: doc.userAgent || undefined,
    platform: doc.platform || undefined,
    enabled: doc.enabled !== false,
    allBotLines: doc.allBotLines !== false,
    botLineIds: Array.isArray(doc.botLineIds) ? doc.botLineIds.map(String) : [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastSeenAt: doc.lastSeenAt || null,
  };
}

export class MongooseDeviceRegistrationRepository extends DeviceRegistrationRepository {
  /**
   * @param {{
   *   userId: string,
   *   tenantId: string,
   *   fid: string,
   *   userAgent?: string,
   *   platform?: string,
   *   allBotLines?: boolean,
   *   botLineIds?: string[],
   * }} registration
   */
  async upsert(registration) {
    const Model = getDeviceRegistrationModel();
    const allBotLines = registration.allBotLines !== false;
    const botLineIds = allBotLines
      ? []
      : [...new Set((registration.botLineIds || []).map(String).filter(Boolean))];

    const doc = await Model.findOneAndUpdate(
      { fid: registration.fid },
      {
        $set: {
          userId: registration.userId,
          tenantId: registration.tenantId,
          userAgent: registration.userAgent || '',
          platform: registration.platform || 'web',
          lastSeenAt: new Date(),
          enabled: true,
          allBotLines,
          botLineIds,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return toRecord(doc);
  }

  async deactivateByFid(params) {
    const Model = getDeviceRegistrationModel();
    const result = await Model.updateOne(
      { fid: params.fid, userId: params.userId, enabled: true },
      { $set: { enabled: false } }
    );
    return (result.modifiedCount || 0) > 0;
  }

  async findEnabledByUser(params) {
    const Model = getDeviceRegistrationModel();
    const query = { userId: params.userId, enabled: true };
    if (params.tenantId) query.tenantId = params.tenantId;
    const docs = await Model.find(query).lean();
    return docs.map(toRecord);
  }

  /**
   * Tenant-scoped: never cross tenants.
   * Match allBotLines=true OR botLineIds contains botLineId.
   */
  async findEnabledByTenantAndBotLine(params) {
    const Model = getDeviceRegistrationModel();
    const botLineId = String(params.botLineId);
    const docs = await Model.find({
      tenantId: String(params.tenantId),
      enabled: true,
      $or: [{ allBotLines: true }, { botLineIds: botLineId }],
    }).lean();
    return docs.map(toRecord);
  }

  async deactivateFids(fids) {
    if (!fids?.length) return 0;
    const Model = getDeviceRegistrationModel();
    const result = await Model.updateMany(
      { fid: { $in: fids }, enabled: true },
      { $set: { enabled: false } }
    );
    return result.modifiedCount || 0;
  }
}

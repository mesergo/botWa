/**
 * DeviceRegistrationRepository — persistence contract for browser FIDs.
 */

/**
 * @interface
 */
export class DeviceRegistrationRepository {
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
   * @returns {Promise<import('../types/index.js').DeviceRegistration>}
   */
  async upsert(_registration) {
    throw new Error('DeviceRegistrationRepository.upsert must be implemented');
  }

  /**
   * @param {{ userId: string, fid: string }} params
   * @returns {Promise<boolean>}
   */
  async deactivateByFid(_params) {
    throw new Error('DeviceRegistrationRepository.deactivateByFid must be implemented');
  }

  /**
   * @param {{ userId: string, tenantId?: string }} params
   * @returns {Promise<import('../types/index.js').DeviceRegistration[]>}
   */
  async findEnabledByUser(_params) {
    throw new Error('DeviceRegistrationRepository.findEnabledByUser must be implemented');
  }

  /**
   * Active devices for a tenant subscribed to a specific bot line.
   * @param {{ tenantId: string, botLineId: string }} params
   * @returns {Promise<import('../types/index.js').DeviceRegistration[]>}
   */
  async findEnabledByTenantAndBotLine(_params) {
    throw new Error('DeviceRegistrationRepository.findEnabledByTenantAndBotLine must be implemented');
  }

  /**
   * @param {string[]} fids
   * @returns {Promise<number>}
   */
  async deactivateFids(_fids) {
    throw new Error('DeviceRegistrationRepository.deactivateFids must be implemented');
  }
}

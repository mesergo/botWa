/**
 * Migration 001 — PushDeviceRegistration collection + indexes (Mongoose).
 *
 * The host app has no formal migration runner. Call ensurePushDeviceRegistrationIndexes()
 * once after MongoDB is connected (wired from server.js).
 *
 * Does not modify any unrelated collections.
 */

import { getDeviceRegistrationModel } from '../models/DeviceRegistration.model.js';

/**
 * Ensures the PushDeviceRegistration collection and indexes exist.
 * Safe to call repeatedly.
 */
export async function ensurePushDeviceRegistrationIndexes() {
  const Model = getDeviceRegistrationModel();
  await Model.createCollection().catch(() => {
    // Collection may already exist
  });
  await Model.syncIndexes();
  console.log('[notifications] PushDeviceRegistration indexes ensured');
}

export default ensurePushDeviceRegistrationIndexes;

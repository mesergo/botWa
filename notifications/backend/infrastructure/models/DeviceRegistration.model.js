/**
 * Mongoose schema for push device registrations (FID-based).
 * Collection: PushDeviceRegistration
 *
 * botLineIds = BotFlow._id strings the user subscribed to.
 * allBotLines = subscribe to every bot line of the tenant.
 */

import { mongoose } from '../../../../backend/config/notificationsVendor.js';

const deviceRegistrationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    fid: { type: String, required: true, unique: true },
    userAgent: { type: String, default: '' },
    platform: { type: String, default: 'web' },
    enabled: { type: Boolean, default: true, index: true },
    allBotLines: { type: Boolean, default: true },
    botLineIds: { type: [String], default: [] },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'PushDeviceRegistration',
  }
);

deviceRegistrationSchema.index({ userId: 1, tenantId: 1, enabled: 1 });
deviceRegistrationSchema.index({ tenantId: 1, enabled: 1 });
deviceRegistrationSchema.index({ userId: 1, fid: 1 }, { unique: true });

export function getDeviceRegistrationModel() {
  return (
    mongoose.models.PushDeviceRegistration ||
    mongoose.model('PushDeviceRegistration', deviceRegistrationSchema)
  );
}

export { deviceRegistrationSchema };

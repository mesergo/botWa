import mongoose from 'mongoose';

/**
 * Expo push device token registered by a user's mobile app install.
 * Mirrors the FCM `DeviceRegistration` pattern (notifications/backend) but
 * kept as a standalone model since Expo push is a separate, simpler channel.
 */
const expoDeviceTokenSchema = new mongoose.Schema({
  // The user who owns this device
  user_id: { type: String, required: true, index: true },

  // Expo push token, e.g. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  token: { type: String, required: true, unique: true },

  platform: { type: String, default: 'android' },

  // Set to false (and stopped from being used) once Expo reports
  // DeviceNotRegistered for this token.
  is_valid: { type: Boolean, default: true, index: true },

  last_seen_at: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'ExpoDeviceToken'
});

expoDeviceTokenSchema.index({ user_id: 1, is_valid: 1 });

export default mongoose.model('ExpoDeviceToken', expoDeviceTokenSchema);

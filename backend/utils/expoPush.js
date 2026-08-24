import fetch from 'node-fetch';
import ExpoDeviceToken from '../models/ExpoDeviceToken.js';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Expo rejects requests carrying more than 100 notifications.
const MAX_MESSAGES_PER_REQUEST = 100;

/**
 * Sends an Expo push notification to every valid device registered by a user.
 *
 * Callers treat this as fire-and-forget (`void sendExpoPushToUser(...)`), so it
 * never throws: any failure is logged and reported through the return value.
 *
 * @param {string} userId
 * @param {{ title?: string, body?: string, data?: Record<string, unknown> }} payload
 * @returns {Promise<{ sent: number, invalidated: number }>}
 */
export async function sendExpoPushToUser(userId, payload = {}) {
  const result = { sent: 0, invalidated: 0 };

  if (!userId) return result;

  const devices = await ExpoDeviceToken.find({ user_id: String(userId), is_valid: true })
    .select('token')
    .lean();

  if (devices.length === 0) return result;

  const messages = devices.map((device) => ({
    to: device.token,
    title: payload.title || '',
    body: payload.body || '',
    data: payload.data || {},
    sound: 'default',
    priority: 'high',
  }));

  for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_REQUEST) {
    const batch = messages.slice(i, i + MAX_MESSAGES_PER_REQUEST);
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error(`[EXPO-PUSH] HTTP ${response.status} for user=${userId}`);
        continue;
      }

      const tickets = (await response.json())?.data || [];
      const staleTokens = [];

      tickets.forEach((ticket, index) => {
        if (ticket?.status === 'ok') {
          result.sent += 1;
          return;
        }
        console.error(`[EXPO-PUSH] ticket error for user=${userId}: ${ticket?.message || 'unknown'}`);
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          staleTokens.push(batch[index].to);
        }
      });

      if (staleTokens.length > 0) {
        const { modifiedCount } = await ExpoDeviceToken.updateMany(
          { token: { $in: staleTokens } },
          { $set: { is_valid: false } }
        );
        result.invalidated += modifiedCount || 0;
      }
    } catch (err) {
      console.error(`[EXPO-PUSH] send failed for user=${userId}:`, err?.message || err);
    }
  }

  return result;
}

export default sendExpoPushToUser;

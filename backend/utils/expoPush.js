/**
 * expoPush.js
 * Shared utility for sending Expo push notifications via
 * https://exp.host/--/api/v2/push/send. Modeled on whatsappSender.js
 * (same fire-and-forget / never-throw / [PREFIX] logging style).
 */
import fetch from 'node-fetch';
import ExpoDeviceToken from '../models/ExpoDeviceToken.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo API accepts at most 100 messages per request.
const EXPO_CHUNK_SIZE = 100;

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Send an Expo push notification to every registered device of a user.
 * Minimal payload only (title + generic body) — never includes actual
 * message text, matching the existing FCM security posture.
 *
 * @param {string} userId
 * @param {{ title?: string, body?: string, data?: object }} payload
 * @returns {Promise<{ success: boolean, skipped?: boolean, reason?: string, error?: string }>}
 */
export const sendExpoPushToUser = async (userId, { title, body, data } = {}) => {
  try {
    if (!userId) return { success: true, skipped: true, reason: 'no_user_id' };

    const tokens = await ExpoDeviceToken.find({ user_id: String(userId), is_valid: true });
    if (!tokens.length) {
      return { success: true, skipped: true, reason: 'no_tokens' };
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      title: title || 'הודעה חדשה',
      body: body || 'עדכון',
      data: data || {},
      sound: 'default',
    }));

    console.log(`[EXPO-PUSH] 📤 Sending to ${messages.length} device(s) for userId=${userId}`);

    const batches = chunk(messages, EXPO_CHUNK_SIZE);
    const tickets = [];

    for (const batch of batches) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      const respJson = await res.json().catch(() => ({}));
      console.log(`[EXPO-PUSH] ⬅️  RESPONSE HTTP ${res.status} | body: ${JSON.stringify(respJson)}`);
      if (Array.isArray(respJson?.data)) tickets.push(...respJson.data);
    }

    // Cleanup: DeviceNotRegistered tokens should stop receiving pushes.
    await Promise.all(tickets.map(async (ticket, idx) => {
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
        const badToken = messages[idx]?.to;
        if (!badToken) return;
        try {
          await ExpoDeviceToken.updateOne({ token: badToken }, { $set: { is_valid: false } });
          console.log(`[EXPO-PUSH] 🧹 Marked token invalid (DeviceNotRegistered): ${badToken}`);
        } catch (cleanupErr) {
          console.error('[EXPO-PUSH] cleanup error:', cleanupErr?.message || cleanupErr);
        }
      }
    }));

    return { success: true };
  } catch (err) {
    console.error('[EXPO-PUSH] isolated error:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
};

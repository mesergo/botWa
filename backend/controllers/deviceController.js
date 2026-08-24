import ExpoDeviceToken from '../models/ExpoDeviceToken.js';

// Expo push tokens look like "ExponentPushToken[xxxxx]" or "ExpoPushToken[xxxxx]".
const EXPO_TOKEN_REGEX = /^(Exponent|Expo)PushToken\[.+\]$/;

/**
 * POST /api/devices/token
 * Register (or refresh) an Expo push device token for the authenticated user.
 * Upserts by token so re-registration (reinstall, re-login on same device)
 * never creates duplicate rows.
 */
export const registerDeviceToken = async (req, res) => {
  try {
    const { token, platform } = req.body || {};

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'token is required' });
    }
    if (!EXPO_TOKEN_REGEX.test(token.trim())) {
      return res.status(400).json({ error: 'token does not look like a valid Expo push token' });
    }

    const doc = await ExpoDeviceToken.findOneAndUpdate(
      { token: token.trim() },
      {
        $set: {
          user_id: String(req.userId),
          platform: platform || 'android',
          is_valid: true,
          last_seen_at: new Date(),
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, id: doc._id });
  } catch (err) {
    console.error('POST /api/devices/token error:', err);
    res.status(500).json({ error: err.message });
  }
};

import mongoose from 'mongoose';
import crypto from 'crypto';
import ApiToken from '../models/ApiToken.js';
import { getEffectiveUserId } from '../middleware/auth.js';

const MAX_NAME_LENGTH = 60;

// Same SHA1(<seed> + "moomoo") convention used across the codebase for
// integration tokens (see authController.js:getTemplates), salted with
// randomness since there's no fixed bot_id to key off of here.
const generateToken = (userId) => {
  const seed = `${userId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
  return crypto.createHash('sha1').update(seed + 'moomoo').digest('hex');
};

const serializeToken = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  token: doc.token,
  expires_at: doc.expires_at,
  is_expired: !!doc.expires_at && new Date(doc.expires_at).getTime() < Date.now(),
  created_at: doc.createdAt
});

// GET /api/api-tokens
export const listApiTokens = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const tokens = await ApiToken.find({ user_id: userId }).sort({ createdAt: -1 });
    res.json({ tokens: tokens.map(serializeToken) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/api-tokens
// Body: { name: string, expires_at?: string }
export const createApiToken = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'שם הטוקן הוא שדה חובה' });
    if (name.length > MAX_NAME_LENGTH) return res.status(400).json({ error: 'שם הטוקן ארוך מדי' });

    let expiresAt = null;
    if (req.body?.expires_at) {
      const parsed = new Date(req.body.expires_at);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'תאריך תפוגה אינו תקין' });
      if (parsed.getTime() <= Date.now()) return res.status(400).json({ error: 'תאריך התפוגה חייב להיות בעתיד' });
      expiresAt = parsed;
    }

    const doc = await ApiToken.create({
      user_id: userId,
      name,
      token: generateToken(userId),
      expires_at: expiresAt
    });

    res.status(201).json({ token: serializeToken(doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/api-tokens/:id
export const deleteApiToken = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid token id' });
    }
    const doc = await ApiToken.findOneAndDelete({ _id: id, user_id: userId });
    if (!doc) return res.status(404).json({ error: 'הטוקן לא נמצא' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

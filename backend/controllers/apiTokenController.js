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

// Same rule as requireCompanyManager: company managers, admins and impersonating admins
// see/manage every token of the account; everyone else only the tokens they created.
const isAccountManager = (req) => {
  const role = req.user?.role;
  return role === 'user' || role === 'admin' || !!req.user?.isImpersonating;
};

// Legacy tokens have no created_by — they count as created by the account owner.
// doc.populated() keeps the raw id even when the creator user was deleted (populate → null).
const creatorIdOf = (doc) => {
  const raw = doc.populated('created_by') || doc.created_by;
  if (!raw) return doc.user_id.toString();
  return (raw._id || raw).toString();
};

const isMine = (doc, req) => creatorIdOf(doc) === String(req.userId);

const maskToken = (value) => `${value.slice(0, 6)}…${value.slice(-4)}`;

const serializeToken = (doc, req) => {
  const mine = isMine(doc, req);
  const creator = doc.populated('created_by') && doc.created_by ? doc.created_by : null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    // The full value is only returned to the user who created the token.
    token: mine ? doc.token : maskToken(doc.token),
    masked: !mine,
    is_mine: mine,
    created_by: creator ? { id: creator._id.toString(), name: creator.name || '', email: creator.email || '' } : null,
    expires_at: doc.expires_at,
    is_expired: !!doc.expires_at && new Date(doc.expires_at).getTime() < Date.now(),
    last_used_at: doc.last_used_at || null,
    created_at: doc.createdAt
  };
};

// Tokens the current user may see/delete within the account.
const visibilityFilter = (req) => {
  const accountId = getEffectiveUserId(req);
  if (isAccountManager(req)) return { user_id: accountId };
  return { user_id: accountId, created_by: req.userId };
};

// GET /api/api-tokens
export const listApiTokens = async (req, res) => {
  try {
    const tokens = await ApiToken.find(visibilityFilter(req))
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });
    res.json({ tokens: tokens.map(doc => serializeToken(doc, req)) });
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
      expires_at: expiresAt,
      created_by: req.userId
    });
    await doc.populate('created_by', 'name email');

    res.status(201).json({ token: serializeToken(doc, req) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/api-tokens/:id
export const deleteApiToken = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid token id' });
    }
    const doc = await ApiToken.findOneAndDelete({ _id: id, ...visibilityFilter(req) });
    if (!doc) return res.status(404).json({ error: 'הטוקן לא נמצא' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

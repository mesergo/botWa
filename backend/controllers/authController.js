
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Version from '../models/Version.js';
import jwt from 'jsonwebtoken';
import { getUserLimits } from '../utils/limits.js';
import { SECRET_KEY, resolvePermissions, getEffectiveUserId } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';
import {
  DEFAULT_REMOVAL_CONFIG,
  getGlobalRemovalConfig,
  getEffectiveRemovalConfig
} from '../utils/removalConfig.js';
import AuditLog from '../models/AuditLog.js';
import { buildRemovalConfigDiff } from './adminController.js';
import PhoneOtp from '../models/PhoneOtp.js';
import { pushMessagesToWhatsApp } from '../utils/whatsappSender.js';
 
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Accepted audiences for Google id_token verification. The web client (GOOGLE_CLIENT_ID)
// issues tokens for the browser sign-in flow; native apps (e.g. Android) issue tokens
// with a different audience (their own OAuth client id), so we must accept both.
const GOOGLE_AUDIENCES = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_ID_ANDROID,
].filter(Boolean);

const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const asBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Phone-number login (OTP via WhatsApp) helpers.
// Normalize a raw phone string down to its last 9 digits (digits-only). Used as the
// matching key since the `phone` field on User is unstructured free text (spaces,
// dashes, parens, optional country code allowed by PHONE_REGEX).
const phoneKeyOf = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.slice(-9);
};
const hashOtp = (code) => crypto.createHash('sha256').update(code).digest('hex');

// Scan users with a non-empty phone and return those whose normalized last-9-digit
// key matches phoneKey. Full-table scan over users-with-phone; acceptable at current
// scale (no phone_normalized index field by design — see plan doc).
const findUsersByPhoneKey = async (phoneKey) => {
  if (!phoneKey) return [];
  const candidates = await User.find({ phone: { $exists: true, $ne: '' } })
    .select('name email phone role manager_id public_id account_type status availability_status trial_expires_at token user_type_id');
  return candidates.filter(u => phoneKeyOf(u.phone) === phoneKey);
};

// Shared with frontend/components/RegisterPage.tsx validation patterns.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+()]{7,15}$/;
// bcrypt/bcryptjs hash prefix ($2a$, $2b$ or $2y$) — used to distinguish hashed
// passwords from legacy plain-text ones stored before hashing was introduced.
const BCRYPT_HASH_REGEX = /^\$2[aby]\$/;
const inviteRequiresLoginConfirmation = async (user) => {
  if (!user) return false;

  const normalizedEmail = (user.email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;

  const emailMatcher = new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i');
  const existingActiveSibling = await User.exists({
    _id: { $ne: user._id },
    email: emailMatcher,
    status: 'active',
  });

  return !!existingActiveSibling;
};

const findInviteUserByToken = async (inviteToken) => {
  if (!inviteToken || typeof inviteToken !== 'string') return null;
  const providedHash = hashInviteToken(inviteToken);
  const user = await User.findOne({ invite_status: 'pending', invite_token_hash: providedHash });
  if (!user || !user.invite_token_hash) return null;

  const stored = Buffer.from(user.invite_token_hash, 'hex');
  const provided = Buffer.from(providedHash, 'hex');
  if (stored.length !== provided.length || !crypto.timingSafeEqual(stored, provided)) {
    return null;
  }
  return user;
};

export const verifyInviteToken = async (req, res) => {
  const { inviteToken } = req.query;
  if (!inviteToken || typeof inviteToken !== 'string') {
    return res.status(400).json({ error: 'inviteToken is required' });
  }

  try {
    const user = await findInviteUserByToken(inviteToken);
    if (!user) {
      return res.status(404).json({ error: 'הזמנה לא תקינה' });
    }

    if (!user.invite_token_expires_at || new Date(user.invite_token_expires_at).getTime() < Date.now()) {
      user.invite_status = 'expired';
      await user.save();
      return res.status(410).json({ error: 'ההזמנה פגה' });
    }

    const inviter = user.invite_created_by
      ? await User.findById(user.invite_created_by).select('name').lean()
      : null;

    return res.json({
      valid: true,
      email: user.email,
      name: user.name,
      inviterName: inviter?.name || '',
      requiresLoginConfirmation: await inviteRequiresLoginConfirmation(user)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const registerFromInvite = async (req, res) => {
  const { inviteToken, email, name, password, phone, confirmLogin } = req.body;
  if (!inviteToken || typeof inviteToken !== 'string') {
    return res.status(400).json({ error: 'inviteToken is required' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password is required' });
  }

  try {
    const user = await findInviteUserByToken(inviteToken);
    if (!user) {
      return res.status(404).json({ error: 'הזמנה לא תקינה' });
    }

    if (!user.invite_token_expires_at || new Date(user.invite_token_expires_at).getTime() < Date.now()) {
      user.invite_status = 'expired';
      await user.save();
      return res.status(410).json({ error: 'ההזמנה פגה' });
    }

    if (typeof email === 'string' && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ error: 'לא ניתן לשנות את כתובת האימייל בהזמנה זו' });
    }
    if (typeof name === 'string' && name.trim() !== user.name) {
      return res.status(400).json({ error: 'לא ניתן לשנות את השם המלא בהזמנה זו' });
    }
    const requiresLoginConfirmation = await inviteRequiresLoginConfirmation(user);
    if (requiresLoginConfirmation && !asBoolean(confirmLogin)) {
      return res.status(400).json({ error: 'יש לאשר התחברות לחשבון המוזמן לפני השלמת ההרשמה' });
    }

    user.password = password;
    if (typeof phone === 'string') user.phone = phone.trim();
    user.status = 'active';
    user.registration_completed_at = new Date();
    user.invite_status = 'accepted';
    user.invite_token_hash = null;
    user.invite_token_expires_at = null;
    await user.save();

    const userId = user._id.toString();
    const userRole = user.role || 'user';
    const managerId = user.manager_id || null;
    const jwtToken = jwt.sign({
      id: userId,
      email: user.email,
      role: userRole,
      manager_id: managerId,
      user_type_id: user.user_type_id || null
    }, SECRET_KEY, { expiresIn: '24h' });

    const permissions = await resolvePermissions(user);

    return res.json({
      token: jwtToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: userRole,
        manager_id: managerId,
        public_id: user.public_id,
        account_type: user.account_type || 'Basic',
        status: user.status || 'active',
        availability_status: user.availability_status || 'unavailable',
        trial_expires_at: user.trial_expires_at || null,
        api_token: user.token,
        user_type_id: user.user_type_id || null,
        permissions
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const registerFromInviteGoogle = async (req, res) => {
  const { inviteToken, credential, confirmLogin } = req.body;
  if (!inviteToken || typeof inviteToken !== 'string') {
    return res.status(400).json({ error: 'inviteToken is required' });
  }
  if (!credential || typeof credential !== 'string') {
    return res.status(400).json({ error: 'Missing Google credential' });
  }

  try {
    const user = await findInviteUserByToken(inviteToken);
    if (!user) {
      return res.status(404).json({ error: 'הזמנה לא תקינה' });
    }

    if (!user.invite_token_expires_at || new Date(user.invite_token_expires_at).getTime() < Date.now()) {
      user.invite_status = 'expired';
      await user.save();
      return res.status(410).json({ error: 'ההזמנה פגה' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_AUDIENCES,
    });
    const payload = ticket.getPayload();
    const googleEmail = (payload?.email || '').toLowerCase().trim();
    const inviteEmail = (user.email || '').toLowerCase().trim();

    if (!googleEmail || googleEmail !== inviteEmail) {
      return res.status(400).json({ error: 'האימייל של חשבון Google אינו תואם להזמנה' });
    }
    const requiresLoginConfirmation = await inviteRequiresLoginConfirmation(user);
    if (requiresLoginConfirmation && !asBoolean(confirmLogin)) {
      return res.status(400).json({ error: 'יש לאשר התחברות לחשבון המוזמן לפני השלמת ההרשמה' });
    }

    // Link googleId to this invited account if missing.
    if (!user.googleId && payload?.sub) {
      user.googleId = payload.sub;
    }

    user.status = 'active';
    user.registration_completed_at = new Date();
    user.invite_status = 'accepted';
    user.invite_token_hash = null;
    user.invite_token_expires_at = null;
    await user.save();

    const userId = user._id.toString();
    const userRole = user.role || 'user';
    const managerId = user.manager_id || null;

    if (userRole === 'rep' || userRole === 'rep_manager') {
      user.availability_status = 'available';
      await user.save();
    }

    const jwtToken = jwt.sign({
      id: userId,
      email: user.email,
      role: userRole,
      manager_id: managerId,
      user_type_id: user.user_type_id || null
    }, SECRET_KEY, { expiresIn: '24h' });

    const permissions = await resolvePermissions(user);

    return res.json({
      token: jwtToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: userRole,
        manager_id: managerId,
        public_id: user.public_id,
        account_type: user.account_type || 'Basic',
        status: user.status || 'active',
        availability_status: user.availability_status || 'unavailable',
        trial_expires_at: user.trial_expires_at || null,
        api_token: user.token,
        user_type_id: user.user_type_id || null,
        permissions
      }
    });
  } catch (err) {
    console.error('Invite Google auth error:', err.message);
    return res.status(401).json({ error: 'אימות גוגל נכשל, נסה שנית' });
  }
};

export const register = async (req, res) => {
  // Accepts either `businessName` (mobile app registration screen) or `name`
  // (existing web RegisterPage) for the account/business name field.
  const { businessName, name, email, phone, password, role } = req.body;
  try {
    const resolvedName = (businessName || name || '').toString().trim();
    const normalizedEmail = (email || '').toString().trim().toLowerCase();
    const trimmedPhone = (phone || '').toString().trim();

    if (!resolvedName) {
      return res.status(400).json({ error: 'שם העסק הוא שדה חובה' });
    }
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'כתובת אימייל אינה תקינה' });
    }
    if (!trimmedPhone || !PHONE_REGEX.test(trimmedPhone)) {
      return res.status(400).json({ error: 'מספר טלפון אינו תקין' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
    }

    const publicId = Math.random().toString(36).substring(2, 15);
    
    // Check if role=admin was requested
    let userRole = 'user';
    if (role === 'admin') {
      // Allow admin creation if:
      // 1. It's the first user in the system (no admins exist)
      // 2. Or in development environment
      const adminCount = await User.countDocuments({ role: 'admin' });
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (adminCount === 0 || isDevelopment) {
        userRole = 'admin';
        console.log(`✅ Creating admin user: ${normalizedEmail} (First admin: ${adminCount === 0}, Dev mode: ${isDevelopment})`);
      } else {
        console.log(`⚠️ Attempted admin creation denied for ${normalizedEmail} - admins already exist in production`);
      }
    }
    
    // Set trial expiry date (1 month from now)
    const trialExpiresAt = new Date();
    trialExpiresAt.setMonth(trialExpiresAt.getMonth() + 1);

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: resolvedName,
      email: normalizedEmail,
      phone: trimmedPhone,
      password: hashedPassword,
      role: userRole,
      public_id: publicId,
      account_type: 'Trial',
      status: 'active',
      trial_expires_at: trialExpiresAt
    });
    
    const userId = user._id.toString();
    const managerId = user.manager_id || null;
    const jwtToken = jwt.sign({
      id: userId,
      email: user.email,
      role: userRole,
      manager_id: managerId,
      user_type_id: user.user_type_id || null
    }, SECRET_KEY, { expiresIn: '24h' });

    const permissions = await resolvePermissions(user);

    // Same response shape as login: JWT token + full user object.
    res.json({ 
      token: jwtToken, 
      user: { 
        id: userId, 
        name: user.name, 
        email: user.email, 
        role: userRole,
        manager_id: managerId,
        public_id: user.public_id, 
        account_type: user.account_type || 'Trial', 
        status: user.status || 'active',
        availability_status: user.availability_status || 'unavailable',
        trial_expires_at: user.trial_expires_at || null,
        api_token: user.token, // API token for WhatsApp integration
        user_type_id: user.user_type_id || null,
        permissions
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password, accountId } = req.body;
  try {
    if (!password || typeof password !== 'string') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Find every account matching this email — with multiple accounts per email
    // now allowed, more than one could share identical credentials. Passwords may
    // be bcrypt-hashed (accounts created after hashing was introduced) or legacy
    // plain-text (older accounts) — check each candidate accordingly.
    const candidates = await User.find({ email });
    const matches = [];
    for (const candidate of candidates) {
      const stored = candidate.password || '';
      const isMatch = BCRYPT_HASH_REGEX.test(stored)
        ? await bcrypt.compare(password, stored)
        : stored === password;
      if (isMatch) matches.push(candidate);
    }
    if (matches.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    let user;
    if (matches.length === 1) {
      user = matches[0];
    } else {
      // Ambiguous: several accounts share this exact email+password. Never guess —
      // require the caller to have pre-selected one via accountId.
      user = accountId ? matches.find(u => u._id.toString() === accountId) : null;
      if (!user) {
        return res.status(409).json({
          requiresAccountSelection: true,
          accounts: matches.map(u => ({
            id: u._id.toString(),
            name: u.name,
            account_type: u.account_type || 'Basic',
            role: u.role || 'user',
            created_at: u.createdAt
          }))
        });
      }
    }
    
    const userId = user._id.toString();
    const userRole = user.role || 'user';
    const managerId = user.manager_id || null;

    // For reps, reset availability to 'available' on every login
    if (userRole === 'rep' || userRole === 'rep_manager') {
      user.availability_status = 'available';
      await user.save();
    }

    const jwtToken = jwt.sign({
      id: userId,
      email: user.email,
      role: userRole,
      manager_id: managerId,
      user_type_id: user.user_type_id || null
    }, SECRET_KEY, { expiresIn: '24h' });
    
    const permissions = await resolvePermissions(user);

    res.json({ 
      token: jwtToken, 
      user: { 
        id: userId, 
        name: user.name, 
        email: user.email, 
        role: userRole,
        manager_id: managerId,
        public_id: user.public_id,
        account_type: user.account_type || 'Basic',
        status: user.status || 'active',
        availability_status: user.availability_status || 'unavailable',
        trial_expires_at: user.trial_expires_at || null,
        api_token: user.token,
        user_type_id: user.user_type_id || null,
        permissions
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Phone-number login step 1: validate phone, look up matching user(s), send a 6-digit
// OTP code via WhatsApp. Login only — does not create accounts. 404 if no user matches
// (no enumeration-hiding concern in this codebase; checkEmail already reveals existence).
export const startPhoneAuth = async (req, res) => {
  const { phone } = req.body;
  try {
    const phoneKey = phoneKeyOf(phone);
    if (phoneKey.length < 9) {
      return res.status(400).json({ error: 'מספר טלפון אינו תקין' });
    }

    const matches = await findUsersByPhoneKey(phoneKey);
    if (matches.length === 0) {
      return res.status(404).json({ error: 'מספר טלפון לא רשום במערכת' });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentRequests = await PhoneOtp.countDocuments({
      phone_key: phoneKey,
      created_at: { $gt: tenMinutesAgo }
    });
    if (recentRequests >= 3) {
      return res.status(429).json({ error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' });
    }

    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    await PhoneOtp.create({
      phone_key: phoneKey,
      code_hash: hashOtp(code),
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      created_at: new Date(),
      attempts: 0,
      consumed: false
    });

    const authBot = { endpoint: process.env.AUTH_WHATSAPP_ENDPOINT || process.env.WHATSAPP_ENDPOINT };
    await pushMessagesToWhatsApp(phone, [{ type: 'Text', text: `קוד האימות שלך: ${code}\nהקוד בתוקף ל-5 דקות.` }], null, authBot);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Phone-number login step 2: verify the OTP code and issue a JWT, identical response
// shape to login(). Supports multi-account-per-phone via the same 409
// requiresAccountSelection pattern used by login()/googleAuth().
export const verifyPhoneAuth = async (req, res) => {
  const { phone, code, accountId } = req.body;
  try {
    const phoneKey = phoneKeyOf(phone);
    if (phoneKey.length < 9 || !code) {
      return res.status(400).json({ error: 'הקוד שגוי או פג תוקף' });
    }

    const otpDoc = await PhoneOtp.findOne({
      phone_key: phoneKey,
      consumed: false,
      otp_expires_at: { $gt: new Date() }
    }).sort({ created_at: -1 });

    if (!otpDoc) {
      return res.status(400).json({ error: 'הקוד שגוי או פג תוקף' });
    }

    if (otpDoc.attempts >= 5) {
      otpDoc.consumed = true;
      await otpDoc.save();
      return res.status(400).json({ error: 'הקוד שגוי או פג תוקף' });
    }

    const providedHash = Buffer.from(hashOtp(String(code)), 'hex');
    const storedHash = Buffer.from(otpDoc.code_hash, 'hex');
    const isMatch = storedHash.length === providedHash.length && crypto.timingSafeEqual(storedHash, providedHash);

    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ error: 'הקוד שגוי או פג תוקף' });
    }

    otpDoc.consumed = true;
    await otpDoc.save();

    const matches = await findUsersByPhoneKey(phoneKey);
    if (matches.length === 0) {
      return res.status(404).json({ error: 'מספר טלפון לא רשום במערכת' });
    }

    let user;
    if (matches.length === 1) {
      user = matches[0];
    } else {
      user = accountId ? matches.find(u => u._id.toString() === accountId) : null;
      if (!user) {
        return res.status(409).json({
          requiresAccountSelection: true,
          accounts: matches.map(u => ({
            id: u._id.toString(),
            name: u.name,
            account_type: u.account_type || 'Basic',
            role: u.role || 'user',
            created_at: u.createdAt
          }))
        });
      }
    }

    const userId = user._id.toString();
    const userRole = user.role || 'user';
    const managerId = user.manager_id || null;

    if (userRole === 'rep' || userRole === 'rep_manager') {
      user.availability_status = 'available';
      await user.save();
    }

    const jwtToken = jwt.sign({
      id: userId,
      email: user.email,
      role: userRole,
      manager_id: managerId,
      user_type_id: user.user_type_id || null
    }, SECRET_KEY, { expiresIn: '24h' });

    const permissions = await resolvePermissions(user);

    res.json({
      token: jwtToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: userRole,
        manager_id: managerId,
        public_id: user.public_id,
        account_type: user.account_type || 'Basic',
        status: user.status || 'active',
        availability_status: user.availability_status || 'unavailable',
        trial_expires_at: user.trial_expires_at || null,
        api_token: user.token,
        user_type_id: user.user_type_id || null,
        permissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check if email already exists in the system
export const checkEmail = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    res.json({ exists: !!existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// List lightweight account info for a given email — used by the pre-login account picker.
// Public route (no auth required), never exposes password/token/googleId.
export const listAccountsForEmail = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const users = await User.find({ email: email.toLowerCase().trim() })
      .select('name account_type role createdAt')
      .sort({ createdAt: 1 });
    res.json({
      accounts: users.map(u => ({
        id: u._id.toString(),
        name: u.name,
        account_type: u.account_type || 'Basic',
        role: u.role || 'user',
        created_at: u.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Google OAuth login/register
export const googleAuth = async (req, res) => {
  const { credential, accountId } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_AUDIENCES,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    const matches = await User.find({ email: email.toLowerCase() });

    let user;
    if (matches.length === 0) {
      const trialExpiresAt = new Date();
      trialExpiresAt.setMonth(trialExpiresAt.getMonth() + 1);
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        public_id: Math.random().toString(36).substring(2, 15),
        account_type: 'Trial',
        status: 'active',
        trial_expires_at: trialExpiresAt,
      });
    } else if (matches.length === 1) {
      user = matches[0];
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Multiple accounts share this email — require the caller to have pre-selected one.
      user = accountId ? matches.find(u => u._id.toString() === accountId) : null;
      if (!user) {
        return res.json({
          requiresAccountSelection: true,
          accounts: matches.map(u => ({
            id: u._id.toString(),
            name: u.name,
            account_type: u.account_type || 'Basic',
            role: u.role || 'user',
            created_at: u.createdAt
          }))
        });
      }
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    }

    const googleRole = user.role || 'user';
    const googleManagerId = user.manager_id || null;

    if (googleRole === 'rep' || googleRole === 'rep_manager') {
      user.availability_status = 'available';
      await user.save();
    }

    const jwtToken = jwt.sign({
      id: user._id.toString(),
      email: user.email,
      role: googleRole,
      manager_id: googleManagerId,
      user_type_id: user.user_type_id || null
    }, SECRET_KEY, { expiresIn: '24h' });
    const googlePermissions = await resolvePermissions(user);
    res.json({
      token: jwtToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: googleRole,
        manager_id: googleManagerId,
        public_id: user.public_id,
        account_type: user.account_type || 'Trial',
        status: user.status || 'active',
        availability_status: user.availability_status || 'unavailable',
        trial_expires_at: user.trial_expires_at || null,
        api_token: user.token,
        user_type_id: user.user_type_id || null,
        permissions: googlePermissions
      },
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'אימות גוגל נכשל, נסה שנית' });
  }
};

// List sibling accounts sharing the authenticated user's email — used by the
// in-app "switch account" banner. Excludes the currently authenticated account.
export const getMyAccounts = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select('email');
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const siblings = await User.find({
      email: currentUser.email,
      _id: { $ne: req.userId }
    }).select('name account_type role createdAt').sort({ createdAt: 1 });

    res.json({
      accounts: siblings.map(u => ({
        id: u._id.toString(),
        name: u.name,
        account_type: u.account_type || 'Basic',
        role: u.role || 'user',
        created_at: u.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Self-service switch to another account sharing the same login email.
// Modeled on adminController.impersonateUser, but scoped by matching email
// instead of admin role, and issues a normal (non-impersonation) 24h token.
export const switchAccount = async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId is required' });
    // Reject anything that isn't a plain ObjectId string (e.g. a query-operator object
    // like { "$ne": null }) before it ever reaches a Mongo query — prevents NoSQL
    // operator injection via User.findById.
    if (typeof accountId !== 'string' || !mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ error: 'Invalid accountId' });
    }

    const currentUser = await User.findById(req.userId).select('email');
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const target = await User.findById(accountId);
    if (!target) return res.status(404).json({ error: 'Account not found' });

    if (target.email.toLowerCase() !== currentUser.email.toLowerCase()) {
      return res.status(403).json({ error: 'Cannot switch to an account with a different email' });
    }

    const targetRole = target.role || 'user';
    const targetManagerId = target.manager_id || null;

    if (targetRole === 'rep' || targetRole === 'rep_manager') {
      target.availability_status = 'available';
      await target.save();
    }

    const jwtToken = jwt.sign({
      id: target._id.toString(),
      email: target.email,
      role: targetRole,
      manager_id: targetManagerId,
      user_type_id: target.user_type_id || null
    }, SECRET_KEY, { expiresIn: '24h' });

    const permissions = await resolvePermissions(target);

    res.json({
      token: jwtToken,
      user: {
        id: target._id.toString(),
        name: target.name,
        email: target.email,
        role: targetRole,
        manager_id: targetManagerId,
        public_id: target.public_id,
        account_type: target.account_type || 'Basic',
        status: target.status || 'active',
        availability_status: target.availability_status || 'unavailable',
        trial_expires_at: target.trial_expires_at || null,
        api_token: target.token,
        user_type_id: target.user_type_id || null,
        permissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get API token for authenticated user
export const getApiToken = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      api_token: user.token,
      usage_example: `http://localhost:3001/api/chat/get-reply-text?phone=PHONE&token=${user.token}&text=MESSAGE&sender=SENDER`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Dialog360 templates for authenticated user
export const getTemplates = async (req, res) => {
  try {
    // Use the effective (owning) account ID so reps / rep-managers pull
    // templates from the account manager they are associated with,
    // instead of trying to look up their own (non-existent) Dialog360 config.
    const userId = getEffectiveUserId(req);
    console.log('[Dialog360] getTemplates called, effective userId:', userId);

    const user = await User.findById(userId);
    
    if (!user) {
      console.error('[Dialog360] User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('[Dialog360] User found:', user.email);
    console.log('[Dialog360] Bot ID from DB:', user.dialog360_bot_id);

    let botId = user.dialog360_bot_id;

    // Fallback: if user has no dialog360_bot_id, use the first bot's endpoint field
    if (!botId) {
      const firstBot = await BotFlow.findOne({
        user_id: userId.toString(),
        endpoint: { $exists: true, $ne: '' }
      }).sort({ created_at: 1 });

      if (firstBot && firstBot.endpoint) {
        const raw = firstBot.endpoint;
        // endpoint stored as bare ID or "dialog360/{id}"
        botId = raw.includes('/') ? raw.split('/').pop() : raw;
        console.log('[Dialog360] Fallback to first bot endpoint, botId:', botId);
      }
    }

    if (!botId) {
      console.warn('[Dialog360] Bot ID not configured for user:', user.email);
      return res.status(400).json({ 
        error: 'Dialog360 Bot ID not configured. Please set Bot ID in user settings.',
        success: false 
      });
    }
    
    // Build endpoint URL and token from bot_id
    const endpoint = `https://app.chatgo.live/api/dialog360/${botId}/message_templates`;
    
    // Generate SHA1 token: SHA1(bot_id + "moomoo")
    const crypto = await import('crypto');
    const token = crypto.createHash('sha1').update(botId + 'moomoo').digest('hex');
    
    console.log('[Dialog360] Fetching from endpoint:', endpoint);
    console.log('[Dialog360] Generated token:', token.substring(0, 10) + '...');
    
    // Fetch templates from Dialog360
    const response = await fetch(endpoint, {
      headers: {
        "token": token
      }
    });
    
    console.log('[Dialog360] Response status:', response.status);
    console.log('[Dialog360] Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Dialog360] API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `Dialog360 API returned status ${response.status}: ${errorText}`,
        success: false
      });
    }
    
    const data = await response.json();
    console.log('[Dialog360] Response data keys:', Object.keys(data));
    console.log('[Dialog360] data.data length:', data.data?.length || 0);
    console.log('[Dialog360] First template:', data.data?.[0]?.name || 'N/A');
    
    res.json({ 
      templates: data,
      success: true 
    });
    
  } catch (err) {
    console.error('[Dialog360] Error fetching templates:', err);
    res.status(500).json({ 
      error: err.message,
      success: false 
    });
  }
};

// Get current user's full profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const [user, active_bots_count, flows_count] = await Promise.all([
      User.findById(userId),
      BotFlow.countDocuments({ user_id: userId }),
      Version.countDocuments({ user_id: userId }),
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const limits_in_effect = await getUserLimits(user);
    const permissions = await resolvePermissions(user);
    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      user_type_id: user.user_type_id || null,
      permissions,
      public_id: user.public_id,
      account_type: user.account_type,
      status: user.status,
      availability_status: user.availability_status || 'unavailable',
      dialog360_bot_id: user.dialog360_bot_id || '',
      createdAt: user.createdAt,
      trial_expires_at: user.trial_expires_at || null,
      custom_limits: {
        max_bots: user.custom_limits?.max_bots ?? null,
        max_versions: user.custom_limits?.max_versions ?? null,
        version_price: user.custom_limits?.version_price ?? null,
        bot_price: user.custom_limits?.bot_price ?? null,
        max_connected_numbers: user.custom_limits?.max_connected_numbers ?? null,
      },
      limits_in_effect,
      active_bots_count,
      flows_count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update current user's editable profile fields (name, email, phone)
export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, email, phone } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) return res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' });
      user.email = normalizedEmail;
    }
    if (name && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;

    await user.save();

    const limits_in_effect = await getUserLimits(user);
    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      public_id: user.public_id,
      account_type: user.account_type,
      status: user.status,
      dialog360_bot_id: user.dialog360_bot_id || '',
      createdAt: user.createdAt,
      trial_expires_at: user.trial_expires_at || null,
      custom_limits: {
        max_bots: user.custom_limits?.max_bots ?? null,
        max_versions: user.custom_limits?.max_versions ?? null,
        version_price: user.custom_limits?.version_price ?? null,
        bot_price: user.custom_limits?.bot_price ?? null,
        max_connected_numbers: user.custom_limits?.max_connected_numbers ?? null,
      },
      limits_in_effect,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update current user's availability status (rep / rep_manager)
export const updateAvailability = async (req, res) => {
  try {
    const userId = req.userId;
    const { availability_status } = req.body;
    const allowed = ['available', 'unavailable', 'on_break'];
    if (!allowed.includes(availability_status)) {
      return res.status(400).json({ error: 'Invalid availability status' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.availability_status = availability_status;
    await user.save();
    res.json({ availability_status: user.availability_status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Logout: mark user as unavailable (rep / rep_manager).
// Token invalidation is handled client-side; this only updates presence.
export const logout = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (user && (user.role === 'rep' || user.role === 'rep_manager')) {
      user.availability_status = 'unavailable';
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Dialog360 Bot ID for authenticated user
export const updateDialog360Credentials = async (req, res) => {
  try {
    const userId = req.userId;
    const { dialog360_bot_id } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        dialog360_bot_id: dialog360_bot_id || ''
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'Dialog360 Bot ID updated successfully',
      dialog360_bot_id: user.dialog360_bot_id
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Auto-removal-from-group config (per-user override) ──────────────────────
// GET /api/auth/removal-config
// Returns: { config, global, defaults, customized }
//   config     → effective config currently in force for this user
//   global     → admin's global default (used when customized=false)
//   defaults   → factory defaults (used by the "reset to defaults" button)
//   customized → whether the user has overridden the global config
export const getUserRemovalConfig = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const global = await getGlobalRemovalConfig();
    const effective = await getEffectiveRemovalConfig(user);

    res.json({
      config: effective,
      global,
      defaults: DEFAULT_REMOVAL_CONFIG,
      customized: !!user.removal_config?.customized,
      override: user.removal_config || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/auth/removal-config
// Body: { customized: boolean, enabled?: boolean, keywords_he?: string[], message_he?: string, keywords_en?: string[], message_en?: string }
// When customized=false, the user reverts to the global default (override cleared).
export const updateUserRemovalConfig = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const body = req.body || {};

    // Snapshot current effective config for diffing
    const previousEffective = await getEffectiveRemovalConfig(user);

    if (body.customized === false) {
      user.removal_config = {
        customized: false,
        enabled: true,
        keywords_he: [],
        message_he: '',
        keywords_en: [],
        message_en: ''
      };
    } else {
      const keywords_he = Array.isArray(body.keywords_he)
        ? body.keywords_he.map(k => String(k || '').trim()).filter(Boolean)
        : [];
      const keywords_en = Array.isArray(body.keywords_en)
        ? body.keywords_en.map(k => String(k || '').trim()).filter(Boolean)
        : [];
      user.removal_config = {
        customized: true,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
        keywords_he,
        message_he: typeof body.message_he === 'string' ? body.message_he : '',
        keywords_en,
        message_en: typeof body.message_en === 'string' ? body.message_en : ''
      };
    }
    user.markModified('removal_config');
    await user.save();

    // Diff and write audit log entries
    const actorId = req.userId;
    const actorEmail = user.email || '';
    const nextEffective = await getEffectiveRemovalConfig(user);
    const logEntries = buildRemovalConfigDiff(previousEffective, nextEffective, actorId, actorEmail);
    if (logEntries.length > 0) {
      await AuditLog.insertMany(logEntries);
    }

    const global = await getGlobalRemovalConfig();
    const effective = nextEffective;
    res.json({
      message: 'Removal config saved',
      config: effective,
      global,
      defaults: DEFAULT_REMOVAL_CONFIG,
      customized: !!user.removal_config?.customized,
      override: user.removal_config || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

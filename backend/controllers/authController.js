
import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Version from '../models/Version.js';
import jwt from 'jsonwebtoken';
import { getUserLimits } from '../utils/limits.js';
import { SECRET_KEY, resolvePermissions } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';
import {
  DEFAULT_REMOVAL_CONFIG,
  getGlobalRemovalConfig,
  getEffectiveRemovalConfig
} from '../utils/removalConfig.js';
import AuditLog from '../models/AuditLog.js';
import { buildRemovalConfigDiff } from './adminController.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const register = async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  try {
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
        console.log(`✅ Creating admin user: ${email} (First admin: ${adminCount === 0}, Dev mode: ${isDevelopment})`);
      } else {
        console.log(`⚠️ Attempted admin creation denied for ${email} - admins already exist in production`);
      }
    }
    
    // Set trial expiry date (1 month from now)
    const trialExpiresAt = new Date();
    trialExpiresAt.setMonth(trialExpiresAt.getMonth() + 1);

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: userRole,
      public_id: publicId,
      account_type: 'Trial',
      status: 'active',
      trial_expires_at: trialExpiresAt
    });
    
    const userId = user._id.toString();
    const jwtToken = jwt.sign({ id: userId, email }, SECRET_KEY, { expiresIn: '24h' });
    
    // Return both JWT token (for dashboard) and API token (for WhatsApp)
    res.json({ 
      token: jwtToken, 
      user: { 
        id: userId, 
        name, 
        email, 
        role: 'user',
        public_id: publicId, 
        account_type: 'Trial', 
        status: 'active',
        trial_expires_at: user.trial_expires_at,
        api_token: user.token // API token for WhatsApp integration
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
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

// Google OAuth login/register
export const googleAuth = async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
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
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
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
    console.log('[Dialog360] getTemplates called, userId:', req.userId);
    
    const userId = req.userId; // From auth middleware
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
    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
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

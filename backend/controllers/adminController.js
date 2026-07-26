import User from '../models/User.js';
import BotSession from '../models/BotSession.js';
import BotFlow from '../models/BotFlow.js';
import AuditLog from '../models/AuditLog.js';
import SystemSetting from '../models/SystemSetting.js';
import { DEFAULT_REMOVAL_CONFIG, getGlobalRemovalConfig } from '../utils/removalConfig.js';
import UserType from '../models/UserType.js';

// Default configuration if DB is empty (used for fallback)
const DEFAULT_ACCOUNTS_CONFIG = {
  Trial: { maxBots: 1, maxVersions: 0, versionPrice: 0, botPrice: 0, canPublish: false, trialDays: 30, maxConnectedNumbers: 1 },
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30, canPublish: true, maxConnectedNumbers: 1 },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30, canPublish: true, maxConnectedNumbers: 3 }
};

export const getSystemSettings = async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ key: 'accounts_config' });
    if (!setting) {
      return res.json(DEFAULT_ACCOUNTS_CONFIG);
    }
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching system settings', error: error.message });
  }
};

export const updateSystemSettings = async (req, res) => {
  const { config } = req.body;
  const adminId = req.user.id;

  try {
    // Upsert the settings
    await SystemSetting.findOneAndUpdate(
      { key: 'accounts_config' },
      { value: config },
      { upsert: true, new: true }
    );

    // Log the action
    await logAdminAction(adminId, 'UPDATE_SYSTEM_SETTINGS', 'System', { config });

    res.json({ message: 'System settings updated successfully', config });
  } catch (error) {
    res.status(500).json({ message: 'Error updating system settings', error: error.message });
  }
};

// ── Removal-from-group default config (admin-managed) ────────────────────────
export const getRemovalConfig = async (req, res) => {
  try {
    const config = await getGlobalRemovalConfig();
    res.json({ config, defaults: DEFAULT_REMOVAL_CONFIG });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching removal config', error: error.message });
  }
};

export const updateRemovalConfig = async (req, res) => {
  try {
    const { config } = req.body || {};
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ message: 'Missing config' });
    }
    const cleaned = {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : true,
      keywords_he: Array.isArray(config.keywords_he)
        ? config.keywords_he.map(k => String(k || '').trim()).filter(Boolean)
        : [],
      message_he: typeof config.message_he === 'string' ? config.message_he : '',
      keywords_en: Array.isArray(config.keywords_en)
        ? config.keywords_en.map(k => String(k || '').trim()).filter(Boolean)
        : [],
      message_en: typeof config.message_en === 'string' ? config.message_en : ''
    };
    if (cleaned.keywords_he.length === 0) cleaned.keywords_he = DEFAULT_REMOVAL_CONFIG.keywords_he;
    if (!cleaned.message_he.trim()) cleaned.message_he = DEFAULT_REMOVAL_CONFIG.message_he;
    if (cleaned.keywords_en.length === 0) cleaned.keywords_en = DEFAULT_REMOVAL_CONFIG.keywords_en;
    if (!cleaned.message_en.trim()) cleaned.message_en = DEFAULT_REMOVAL_CONFIG.message_en;

    // Load current config before saving so we can diff it
    const previous = await getGlobalRemovalConfig();

    await SystemSetting.findOneAndUpdate(
      { key: 'removal_config' },
      { value: cleaned, description: 'Global default config for the auto-removal-from-group feature' },
      { upsert: true, new: true }
    );

    // Diff and write audit log entries
    const actorId = req.user?.id;
    const actorEmail = req.user?.email || '';
    const logEntries = buildRemovalConfigDiff(previous, cleaned, actorId, actorEmail);
    if (logEntries.length > 0) {
      await AuditLog.insertMany(logEntries);
    }

    res.json({ message: 'Removal config updated', config: cleaned });
  } catch (error) {
    res.status(500).json({ message: 'Error updating removal config', error: error.message });
  }
};

// GET /api/admin/settings/removal/log?page=1
export const getRemovalConfigLog = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      AuditLog.find({ target_type: 'RemovalConfig' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments({ target_type: 'RemovalConfig' })
    ]);
    res.json({ entries, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching removal config log', error: error.message });
  }
};

// Helper: diff two removal configs and return AuditLog documents to insert
export const buildRemovalConfigDiff = (previous, next, actorId, actorEmail) => {
  const entries = [];

  // Diff Hebrew keywords
  const prevHe = Array.isArray(previous?.keywords_he) ? previous.keywords_he : [];
  const nextHe = Array.isArray(next?.keywords_he) ? next.keywords_he : [];
  const prevHeSet = new Set(prevHe.map(k => k.trim().toLowerCase()));
  const nextHeSet = new Set(nextHe.map(k => k.trim().toLowerCase()));
  for (const kw of nextHe) {
    if (!prevHeSet.has(kw.trim().toLowerCase())) {
      entries.push({ action: 'REMOVAL_KEYWORD_HE_ADDED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: { keyword: kw } });
    }
  }
  for (const kw of prevHe) {
    if (!nextHeSet.has(kw.trim().toLowerCase())) {
      entries.push({ action: 'REMOVAL_KEYWORD_HE_REMOVED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: { keyword: kw } });
    }
  }

  // Diff English keywords
  const prevEn = Array.isArray(previous?.keywords_en) ? previous.keywords_en : [];
  const nextEn = Array.isArray(next?.keywords_en) ? next.keywords_en : [];
  const prevEnSet = new Set(prevEn.map(k => k.trim().toLowerCase()));
  const nextEnSet = new Set(nextEn.map(k => k.trim().toLowerCase()));
  for (const kw of nextEn) {
    if (!prevEnSet.has(kw.trim().toLowerCase())) {
      entries.push({ action: 'REMOVAL_KEYWORD_EN_ADDED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: { keyword: kw } });
    }
  }
  for (const kw of prevEn) {
    if (!nextEnSet.has(kw.trim().toLowerCase())) {
      entries.push({ action: 'REMOVAL_KEYWORD_EN_REMOVED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: { keyword: kw } });
    }
  }

  // Enabled toggle
  if (previous?.enabled !== next?.enabled) {
    entries.push({ action: next?.enabled ? 'REMOVAL_ENABLED' : 'REMOVAL_DISABLED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: {} });
  }
  return entries;
};
import jwt from 'jsonwebtoken';
import { SECRET_KEY, resolvePermissions } from '../middleware/auth.js';
import { getUserLimits } from '../utils/limits.js'; // Added limit checker

// Helper to log admin actions
const logAdminAction = async (adminId, adminEmail, action, targetId, targetType, details) => {
  try {
    await AuditLog.create({
      action,
      actor_id: adminId,
      actor_email: adminEmail,
      target_id: targetId,
      target_type: targetType,
      details
    });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
};

// Get system stats for dashboard
export const getSystemStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const totalBots = await BotFlow.countDocuments({});
    
    // New users today, this week, this month
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
    const newUsersWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } });
    const newUsersMonth = await User.countDocuments({ createdAt: { $gte: monthAgo } });
    
    res.json({
      totalUsers,
      totalBots,
      usersGrowth: {
        today: newUsersToday,
        week: newUsersWeek,
        month: newUsersMonth
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all users (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})

      .select('-password')
      .populate('user_type_id', 'name system_role')
      .sort({ createdAt: -1 });
    
    // Get additional stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const userId = user._id.toString();
      const botCount = await BotFlow.countDocuments({ user_id: userId }); // Fixed: Use BotFlow, not Session
      const sessionCount = await BotSession.countDocuments({ user_id: userId });
      
      const limits = await getUserLimits(user);
      
      return {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role,
        dialog360_bot_id: user.dialog360_bot_id,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        manager_id: user.manager_id || null,
        allowed_bot_ids: (user.allowed_bot_ids || []).map(id => id.toString()),
        user_type_id: user.user_type_id || null,
        sms_in_enabled: user.sms_in_enabled === true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        custom_limits: user.custom_limits,
        limits_in_effect: limits,
        stats: {
          bots: botCount,
          flows: sessionCount
        }
      };
    }));
    
    res.json({ users: usersWithStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get specific user details (admin only)
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const bots = await BotFlow.find({ user_id: userId }); // Fixed: BotFlow
    const sessionCount = await BotSession.countDocuments({ user_id: userId });
    const limits = await getUserLimits(user);
    
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
        dialog360_bot_id: user.dialog360_bot_id,
        manager_id: user.manager_id || null,
        allowed_bot_ids: (user.allowed_bot_ids || []).map(id => id.toString()),
        sms_in_enabled: user.sms_in_enabled === true,
        custom_limits: user.custom_limits,
        limits_in_effect: limits,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        stats: {
            bots: bots.length, // Added this line to fix the bug
            flows: sessionCount
        }
      },
      bots
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user details (admin)
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, password, status, account_type, custom_limits, dialog360_bot_id, user_type_id, manager_id, allowed_bot_ids, sms_in_enabled } = req.body;
    
    console.log('[Admin] Updating user:', userId, 'with data:', { ...req.body, password: password ? '***' : undefined });
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update fields 
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (password) user.password = password;
    if (status) user.status = status;
    if (account_type) user.account_type = account_type;
    if (dialog360_bot_id !== undefined) user.dialog360_bot_id = dialog360_bot_id;
    if (manager_id !== undefined) user.manager_id = manager_id || null;
    if (Array.isArray(allowed_bot_ids)) user.allowed_bot_ids = allowed_bot_ids;
    if (sms_in_enabled !== undefined) user.sms_in_enabled = sms_in_enabled === true;
    
    // Update user type / permissions
    if (user_type_id !== undefined) {
      if (user_type_id) {
        const userType = await UserType.findById(user_type_id);
        if (!userType) return res.status(400).json({ error: 'סוג משתמש לא נמצא' });
        user.user_type_id = user_type_id;
        // Sync the legacy role field from the user type's system_role
        if (userType.system_role) user.role = userType.system_role;
      } else {
        user.user_type_id = null;
      }
    }
    
    // Update custom limits if provided
    if (custom_limits) {
      user.custom_limits = {
        ...user.custom_limits,
        ...custom_limits
      };
    }
    
    await user.save();
    await user.populate('user_type_id', 'name system_role');
    
    console.log('[Admin] User saved successfully. dialog360_bot_id:', user.dialog360_bot_id);
    
    await logAdminAction(req.userId, req.user.email, 'UPDATE_USER', userId, 'User', { 
      name, email, status, account_type, dialog360_bot_id 
    });
    
    // Return full user object with all fields
    const limits = await getUserLimits(user);
    const botCount = await BotFlow.countDocuments({ user_id: userId });
    const sessionCount = await BotSession.countDocuments({ user_id: userId });
    
    res.json({ 
      message: 'User updated successfully', 
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
        dialog360_bot_id: user.dialog360_bot_id,
        user_type_id: user.user_type_id || null,
        manager_id: user.manager_id || null,
        allowed_bot_ids: (user.allowed_bot_ids || []).map(id => id.toString()),
        sms_in_enabled: user.sms_in_enabled === true,
        custom_limits: user.custom_limits,
        limits_in_effect: limits,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        stats: {
          bots: botCount,
          flows: sessionCount
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete user (admin)
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 1. Delete all user's bots
    await BotFlow.deleteMany({ user_id: userId });
    
    // 2. Delete user
    await User.findByIdAndDelete(userId);
    
    await logAdminAction(req.userId, req.user.email, 'DELETE_USER', userId, 'User', { 
      deletedEmail: user.email 
    });
    
    res.json({ success: true, message: 'User and all associated data deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Impersonate user - generate token as if logging in as that user
export const impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate a token for the target user with impersonation flag
    const impersonationToken = jwt.sign(
      { 
        id: userId, 
        email: user.email,
        role: user.role,
        manager_id: user.manager_id || null,
        user_type_id: user.user_type_id || null,
        impersonatedBy: req.userId, // Track who is impersonating
        isImpersonating: true
      }, 
      SECRET_KEY,
      { expiresIn: '2h' } // Impersonation tokens expire after 2 hours
    );

    const permissions = await resolvePermissions(user);
    
    await logAdminAction(req.userId, req.user.email, 'IMPERSONATE', userId, 'User', { 
      targetEmail: user.email 
    });
    
    res.json({
      token: impersonationToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        user_type_id: user.user_type_id || null,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
        permissions,
        isImpersonating: true,
        impersonatedBy: req.userId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Stop impersonation and return to admin account
export const stopImpersonation = async (req, res) => {
  try {
    const adminUserId = req.user.impersonatedBy;
    
    if (!adminUserId) {
      return res.status(400).json({ error: 'Not currently impersonating' });
    }
    
    const adminUser = await User.findById(adminUserId);
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    // Generate a fresh admin token
    const adminToken = jwt.sign(
      {
        id: adminUserId,
        email: adminUser.email,
        role: adminUser.role,
        manager_id: adminUser.manager_id || null,
        user_type_id: adminUser.user_type_id || null
      },
      SECRET_KEY
    );

    const adminPermissions = await resolvePermissions(adminUser);
    
    res.json({
      token: adminToken,
      user: {
        id: adminUserId,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        user_type_id: adminUser.user_type_id || null,
        public_id: adminUser.public_id,
        account_type: adminUser.account_type,
        status: adminUser.status,
        api_token: adminUser.token,
        permissions: adminPermissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user role (promote to admin or demote to user)
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.role = role;
    await user.save();
    
    await logAdminAction(req.userId, req.user.email, 'CHANGE_ROLE', userId, 'User', { newRole: role });
    
    res.json({
      message: `User role updated to ${role}`,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new user directly from the admin panel
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, account_type, user_type_id, manager_id, allowed_bot_ids, allowDuplicateEmail } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'שם ואימייל נדרשים' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingAccounts = await User.find({ email: normalizedEmail }).select('name account_type role createdAt');
    if (existingAccounts.length > 0 && allowDuplicateEmail !== true) {
      return res.status(409).json({
        emailExists: true,
        count: existingAccounts.length,
        accounts: existingAccounts.map(u => ({
          id: u._id.toString(),
          name: u.name,
          account_type: u.account_type || 'Basic',
          role: u.role || 'user',
          created_at: u.createdAt
        }))
      });
    }

    // Determine role from user_type if provided
    let role = 'user';
    let resolvedUserTypeId = null;
    if (user_type_id) {
      const userType = await UserType.findById(user_type_id);
      if (!userType) return res.status(400).json({ error: 'סוג משתמש לא קיים' });
      role = userType.system_role || 'user';
      resolvedUserTypeId = userType._id;
    }

    const publicId = Math.random().toString(36).substring(2, 15);
    const trialExpiresAt = new Date();
    trialExpiresAt.setMonth(trialExpiresAt.getMonth() + 1);

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      phone: phone || '',
      password: password || null,
      role,
      public_id: publicId,
      account_type: account_type || 'Trial',
      status: 'active',
      trial_expires_at: trialExpiresAt,
      user_type_id: resolvedUserTypeId,
      manager_id: manager_id || null,
      allowed_bot_ids: Array.isArray(allowed_bot_ids) ? allowed_bot_ids : []
    });

    await logAdminAction(req.userId, req.user.email, 'CREATE_USER', user._id.toString(), 'User', {
      createdEmail: email, role, user_type_id: resolvedUserTypeId
    });

    res.status(201).json({
      message: 'משתמש נוצר בהצלחה',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        user_type_id: resolvedUserTypeId,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

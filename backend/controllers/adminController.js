import User from '../models/User.js';
import BotSession from '../models/BotSession.js';
import BotFlow from '../models/BotFlow.js';
import AuditLog from '../models/AuditLog.js';
import SystemSetting from '../models/SystemSetting.js';
import UserType from '../models/UserType.js';

// Default configuration if DB is empty (used for fallback)
const DEFAULT_ACCOUNTS_CONFIG = {
  Trial: { maxBots: 1, maxVersions: 0, versionPrice: 0, botPrice: 0, canPublish: false, trialDays: 30 },
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30, canPublish: true },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30, canPublish: true }
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
        role: user.role,
        dialog360_bot_id: user.dialog360_bot_id,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        manager_id: user.manager_id || null,
        user_type_id: user.user_type_id || null,
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
    
    const user = await User.findById(userId).select('-password');
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
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
        dialog360_bot_id: user.dialog360_bot_id,
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
    const { name, email, phone, status, account_type, custom_limits, dialog360_bot_id } = req.body;
    
    console.log('[Admin] Updating user:', userId, 'with data:', req.body);
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update fields 
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (status) user.status = status;
    if (account_type) user.account_type = account_type;
    if (dialog360_bot_id !== undefined) user.dialog360_bot_id = dialog360_bot_id;
    
    // Update custom limits if provided
    if (custom_limits) {
      user.custom_limits = {
        ...user.custom_limits,
        ...custom_limits
      };
    }
    
    await user.save();
    
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
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
        dialog360_bot_id: user.dialog360_bot_id,
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
    const { name, email, phone, password, account_type, user_type_id } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'שם ואימייל נדרשים' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' });
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
      user_type_id: resolvedUserTypeId
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

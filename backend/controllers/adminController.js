import User from '../models/User.js';
import BotSession from '../models/BotSession.js';
import BotFlow from '../models/BotFlow.js';
import AuditLog from '../models/AuditLog.js';
import SystemSetting from '../models/SystemSetting.js';

// Default configuration if DB is empty (used for fallback)
const DEFAULT_ACCOUNTS_CONFIG = {
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30 },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30 }
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
import { SECRET_KEY } from '../middleware/auth.js';
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
      .select('-password') // Don't send passwords
      .sort({ createdAt: -1 });
    
    // Get additional stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const userId = user._id.toString();
      const botCount = await BotFlow.countDocuments({ user_id: userId }); // Fixed: Use BotFlow, not Session
      
      const limits = await getUserLimits(user);
      
      return {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        custom_limits: user.custom_limits,
        limits_in_effect: limits,
        stats: {
          bots: botCount
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
        custom_limits: user.custom_limits,
        limits_in_effect: limits,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
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
    const { name, email, phone, status, account_type, custom_limits } = req.body;
    
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
    
    // Update custom limits if provided
    if (custom_limits) {
      user.custom_limits = {
        ...user.custom_limits,
        ...custom_limits
      };
    }
    
    await user.save();
    
    await logAdminAction(req.userId, req.user.email, 'UPDATE_USER', userId, 'User', { 
      name, email, status, account_type 
    });
    
    res.json({ message: 'User updated successfully', user });
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
        impersonatedBy: req.userId, // Track who is impersonating
        isImpersonating: true
      }, 
      SECRET_KEY,
      { expiresIn: '2h' } // Impersonation tokens expire after 2 hours
    );
    
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
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
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
      { id: adminUserId, email: adminUser.email },
      SECRET_KEY
    );
    
    res.json({
      token: adminToken,
      user: {
        id: adminUserId,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        public_id: adminUser.public_id,
        account_type: adminUser.account_type,
        status: adminUser.status,
        api_token: adminUser.token
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

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  getSystemStats,
  getAllUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  impersonateUser,
  stopImpersonation,
  updateUserRole,
  getSystemSettings,
  updateSystemSettings,
  getRemovalConfig,
  updateRemovalConfig,
  createUser
} from '../controllers/adminController.js';
import {
  listUserTypes,
  createUserType,
  updateUserType,
  deleteUserType
} from '../controllers/userTypeController.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);

// System Settings (Global Limits)
router.get('/settings/limits', requireAdmin, getSystemSettings);
router.put('/settings/limits', requireAdmin, updateSystemSettings);

// Global default config for the auto-removal-from-group feature
router.get('/settings/removal', requireAdmin, getRemovalConfig);
router.put('/settings/removal', requireAdmin, updateRemovalConfig);

// Dashboard stats
router.get('/stats', requireAdmin, getSystemStats);

// User Types (dynamic role templates)
router.get('/user-types', requireAdmin, listUserTypes);
router.post('/user-types', requireAdmin, createUserType);
router.put('/user-types/:id', requireAdmin, updateUserType);
router.delete('/user-types/:id', requireAdmin, deleteUserType);

// Get all users
router.get('/users', requireAdmin, getAllUsers);

// Create user directly from admin panel
router.post('/users', requireAdmin, createUser);

// User operations
router.get('/users/:userId', requireAdmin, getUserDetails);
router.patch('/users/:userId', requireAdmin, updateUser);
router.delete('/users/:userId', requireAdmin, deleteUser);

// Role management
router.patch('/users/:userId/role', requireAdmin, updateUserRole);

// Impersonation
router.post('/impersonate/:userId', requireAdmin, impersonateUser);
router.post('/stop-impersonation', stopImpersonation);

export default router;

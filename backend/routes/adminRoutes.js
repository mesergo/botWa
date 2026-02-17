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
  updateSystemSettings
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);

// System Settings (Global Limits)
router.get('/settings/limits', requireAdmin, getSystemSettings);
router.put('/settings/limits', requireAdmin, updateSystemSettings);

// Dashboard stats
router.get('/stats', requireAdmin, getSystemStats);

// Get all users
router.get('/users', requireAdmin, getAllUsers);

// User operations
router.get('/users/:userId', requireAdmin, getUserDetails);
router.patch('/users/:userId', requireAdmin, updateUser); // New: Update user details & limits
router.delete('/users/:userId', requireAdmin, deleteUser); // New: Delete user

// Role management
router.patch('/users/:userId/role', requireAdmin, updateUserRole);

// Impersonation
router.post('/impersonate/:userId', requireAdmin, impersonateUser);
router.post('/stop-impersonation', stopImpersonation);

export default router;

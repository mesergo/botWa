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
  getRemovalConfigLog,
  createUser,
  getUserDialog360Templates,
  getUserDialog360TemplateSettings,
  updateUserDialog360TemplateVisibility,
  updateUserDialog360TemplateDefaultMedia,
  getUserConnectedNumbers,
  getAllConnectedNumbers,
  updateConnectedNumberPaymentCountries,
  linkNumberForCustomer,
  linkDialog360NumberForCustomer,
  getUserBots 
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
router.get('/settings/removal/log', requireAdmin, getRemovalConfigLog);

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

// Per-customer Dialog360 message templates (admin view/manage on the customer's behalf)
router.get('/users/:userId/dialog360-templates', requireAdmin, getUserDialog360Templates);
router.get('/users/:userId/dialog360-template-settings', requireAdmin, getUserDialog360TemplateSettings);
router.post('/users/:userId/dialog360-template-settings/toggle', requireAdmin, updateUserDialog360TemplateVisibility);
router.post('/users/:userId/dialog360-template-settings/default-media', requireAdmin, updateUserDialog360TemplateDefaultMedia);

// Per-customer connected WhatsApp numbers (read-only admin view)
router.get('/users/:userId/connected-numbers', requireAdmin, getUserConnectedNumbers);
router.patch('/users/:userId/connected-numbers/:phoneNumberId/payment-countries', requireAdmin, updateConnectedNumberPaymentCountries);

// Admin-only: link a new/already-activated Facebook WhatsApp number directly to a customer's account
router.post('/users/:userId/connected-numbers/link-facebook', requireAdmin, linkNumberForCustomer);

// Admin-only: link a new/already-activated Dialog360 WhatsApp number directly to a customer's account
router.post('/users/:userId/connected-numbers/link-dialog360', requireAdmin, linkDialog360NumberForCustomer);

// Per-customer bot list (lightweight id/name, used for the Sessions tab's advanced bot search)
router.get('/users/:userId/bots', requireAdmin, getUserBots);

// All connected WhatsApp numbers across every customer (global admin view)
router.get('/connected-numbers', requireAdmin, getAllConnectedNumbers);

// Role management
router.patch('/users/:userId/role', requireAdmin, updateUserRole);

// Impersonation
router.post('/impersonate/:userId', requireAdmin, impersonateUser);
router.post('/stop-impersonation', stopImpersonation);

export default router;

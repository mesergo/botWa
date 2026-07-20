import express from 'express';
import { register, login, getApiToken, checkEmail, listAccountsForEmail, googleAuth, getTemplates, updateDialog360Credentials, getProfile, updateProfile, updateAvailability, logout, getUserRemovalConfig, updateUserRemovalConfig, getMyAccounts, switchAccount } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/check-email', checkEmail); // Check if email already exists
router.get('/accounts-for-email', listAccountsForEmail); // Lightweight accounts list for pre-login picker
router.get('/api-token', authenticate, getApiToken); // Get API token for WhatsApp
router.get('/templates', authenticate, getTemplates); // Get Dialog360 templates
router.put('/dialog360-credentials', authenticate, updateDialog360Credentials); // Update Dialog360 credentials
router.get('/profile', authenticate, getProfile); // Get current user's full profile
router.patch('/profile', authenticate, updateProfile); // Update current user's profile
router.patch('/availability', authenticate, updateAvailability); // Update current user's availability status
router.post('/logout', authenticate, logout); // Mark current user as unavailable on logout
router.get('/removal-config', authenticate, getUserRemovalConfig); // Get auto-removal config (effective + defaults)
router.put('/removal-config', authenticate, updateUserRemovalConfig); // Update per-user override
router.get('/my-accounts', authenticate, getMyAccounts); // Sibling accounts sharing this email (switch-account banner)
router.post('/switch-account', authenticate, switchAccount); // Self-service switch to a sibling account

export default router; 
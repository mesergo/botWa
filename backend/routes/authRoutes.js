import express from 'express';
import { register, login, getApiToken, checkEmail, googleAuth, getTemplates, updateDialog360Credentials } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/check-email', checkEmail); // Check if email already exists
router.get('/api-token', authenticate, getApiToken); // Get API token for WhatsApp
router.get('/templates', authenticate, getTemplates); // Get Dialog360 templates
router.put('/dialog360-credentials', authenticate, updateDialog360Credentials); // Update Dialog360 credentials

export default router; 
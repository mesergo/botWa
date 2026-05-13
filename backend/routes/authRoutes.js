import express from 'express';
import { register, login, getApiToken, checkEmail, googleAuth } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/check-email', checkEmail); // Check if email already exists
router.get('/api-token', authenticate, getApiToken); // Get API token for WhatsApp

export default router;
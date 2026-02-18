import express from 'express';
import { register, login, getApiToken } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/api-token', authenticate, getApiToken); // Get API token for WhatsApp

export default router;
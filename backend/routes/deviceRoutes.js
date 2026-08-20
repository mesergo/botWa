import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { registerDeviceToken } from '../controllers/deviceController.js';

const router = express.Router();

// POST /api/devices/token — register/refresh an Expo push device token
router.post('/token', authenticateToken, registerDeviceToken);

export default router;

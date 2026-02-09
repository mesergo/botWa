
import express from 'express';
import { syncFlow, getFlow, getPublicFlow } from '../controllers/flowController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/sync', authenticateToken, syncFlow);
router.get('/', authenticateToken, getFlow);
router.get('/public/:userId', getPublicFlow); // נתיב חדש ללא authenticateToken

export default router;

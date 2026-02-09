
import express from 'express';
import { startSession, updateSessionParameters } from '../controllers/sessionController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/start', authenticateToken, startSession);
router.post('/update-parameters', authenticateToken, updateSessionParameters);

export default router;

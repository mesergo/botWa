import express from 'express';
import { initializeFromTemplate } from '../controllers/templateController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/initialize', authenticateToken, initializeFromTemplate);

export default router;
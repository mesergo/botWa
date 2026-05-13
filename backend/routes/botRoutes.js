
import express from 'express';
import { createBot, getBots, deleteBot, setDefaultBot, updateBotParams, connectFacebook } from '../controllers/botController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, createBot);
router.get('/', authenticateToken, getBots);
router.delete('/:id', authenticateToken, deleteBot);
router.patch('/:id/set-default', authenticateToken, setDefaultBot);
router.patch('/:id/params', authenticateToken, updateBotParams);
router.post('/:id/connect-facebook', authenticateToken, connectFacebook);

export default router;

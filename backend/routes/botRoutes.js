
import express from 'express';
import { createBot, getBots, deleteBot, setDefaultBot, updateBotParams, connectFacebook, updateBotPublicId } from '../controllers/botController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, createBot);
router.get('/', authenticateToken, getBots);
router.delete('/:id', authenticateToken, deleteBot);
router.patch('/:id/set-default', authenticateToken, setDefaultBot);
router.patch('/:id/params', authenticateToken, updateBotParams);
router.post('/:id/connect-facebook', authenticateToken, connectFacebook);
router.patch('/:id/public-id', authenticateToken, updateBotPublicId);

export default router;

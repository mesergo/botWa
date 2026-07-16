
import express from 'express';
import { createProcess, getProcesses, deleteProcess, getProcessUsage, renameProcess } from '../controllers/processController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, createProcess);
router.get('/', authenticateToken, getProcesses);
router.get('/:id/usage', authenticateToken, getProcessUsage);
router.patch('/:id', authenticateToken, renameProcess);
router.delete('/:id', authenticateToken, deleteProcess);

export default router;

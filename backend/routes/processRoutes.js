
import express from 'express';
import { createProcess, getProcesses, deleteProcess } from '../controllers/processController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, createProcess);
router.get('/', authenticateToken, getProcesses);
router.delete('/:id', authenticateToken, deleteProcess);

export default router;

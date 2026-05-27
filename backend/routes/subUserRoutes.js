import express from 'express';
import { authenticateToken, requireCompanyManager, requireManagerOrRepManager } from '../middleware/auth.js';
import {
  getSubUsers,
  createSubUser,
  updateSubUser,
  deleteSubUser,
} from '../controllers/subUserController.js';

const router = express.Router();

// GET: company managers AND rep_managers may list sub-users (needed for assign modal)
router.get('/', authenticateToken, requireManagerOrRepManager, getSubUsers);

// Mutations: only company managers
router.post('/', authenticateToken, requireCompanyManager, createSubUser);
router.patch('/:id', authenticateToken, requireCompanyManager, updateSubUser);
router.delete('/:id', authenticateToken, requireCompanyManager, deleteSubUser);

export default router;

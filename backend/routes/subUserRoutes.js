import express from 'express';
import { authenticateToken, requireManagerOrRepManager, requirePermission } from '../middleware/auth.js';
import {
  getSubUsers,
  createSubUser,
  updateSubUser,
  deleteSubUser,
} from '../controllers/subUserController.js';

const router = express.Router();

// GET: company managers AND rep_managers (and users with users.view permission) may list sub-users
router.get('/', authenticateToken, requireManagerOrRepManager, getSubUsers);

// Mutations: company managers OR users with the matching permission
router.post('/', authenticateToken, requirePermission('users.add'), createSubUser);
router.patch('/:id', authenticateToken, requirePermission('users.edit'), updateSubUser);
router.delete('/:id', authenticateToken, requirePermission('users.delete'), deleteSubUser);

export default router;

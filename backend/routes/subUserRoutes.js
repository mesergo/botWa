import express from 'express';
import { authenticateToken, requireCompanyManager } from '../middleware/auth.js';
import {
  getSubUsers,
  createSubUser,
  updateSubUser,
  deleteSubUser,
} from '../controllers/subUserController.js';

const router = express.Router();

// All routes: must be logged in AND be a company manager (role === 'user')
router.use(authenticateToken, requireCompanyManager);

router.get('/', getSubUsers);
router.post('/', createSubUser);
router.patch('/:id', updateSubUser);
router.delete('/:id', deleteSubUser);

export default router;

import express from 'express';
import {
  listInternalTemplates,
  createInternalTemplate,
  updateInternalTemplate,
  deleteInternalTemplate
} from '../controllers/internalTemplateController.js';
import { authenticateToken, requireCompanyManager } from '../middleware/auth.js';

const router = express.Router();

// List internal templates - visible to all authenticated roles on the account
router.get('/', authenticateToken, listInternalTemplates);

// Create/update/delete - only company managers/admins
router.post('/', authenticateToken, requireCompanyManager, createInternalTemplate);
router.put('/:id', authenticateToken, requireCompanyManager, updateInternalTemplate);
router.delete('/:id', authenticateToken, requireCompanyManager, deleteInternalTemplate);

export default router;

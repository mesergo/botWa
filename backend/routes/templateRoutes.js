import express from 'express';
import { 
  initializeFromTemplate, 
  getAllTemplates,
  getPublicTemplates,
  getTemplate,
  getTemplateFlow,
  updateTemplateFlow,
  createTemplate, 
  updateTemplate, 
  deleteTemplate,
  createTemplateFromBot,
  getAllSystemBots,
  cloneBotFlow
} from '../controllers/templateController.js';
import { authenticateToken, requireAdmin, optionalAuthToken } from '../middleware/auth.js';


const router = express.Router();

router.post('/initialize', authenticateToken, initializeFromTemplate);
router.post('/clone-bot', authenticateToken, cloneBotFlow);

// Template Management
router.get('/public', optionalAuthToken, getPublicTemplates); // Public templates (optional auth for impersonation detection)
router.get('/admin/all-bots', authenticateToken, requireAdmin, getAllSystemBots); // All system bots for admin template creation
router.get('/', authenticateToken, getAllTemplates); // Allow all authenticated users to view
router.get('/:id', authenticateToken, getTemplate);
router.get('/:id/flow', authenticateToken, getTemplateFlow);
router.put('/:id/flow', authenticateToken, requireAdmin, updateTemplateFlow);
router.post('/', authenticateToken, requireAdmin, createTemplate);
router.put('/:id', authenticateToken, requireAdmin, updateTemplate);
router.delete('/:id', authenticateToken, requireAdmin, deleteTemplate);
router.post('/from-bot', authenticateToken, requireAdmin, createTemplateFromBot);

export default router;

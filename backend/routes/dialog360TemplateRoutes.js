import express from 'express';
import { 
  getTemplateSettings,
  getTemplateSetting,
  toggleShowInChat,
  setDefaultMedia,
  updatePostSendMode,
  deleteTemplateSetting,
  addTemplate,
  editTemplate,
  deleteWaTemplate
} from '../controllers/dialog360TemplateController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all template settings
router.get('/', authenticateToken, getTemplateSettings);

// Get single template setting
router.get('/:templateName', authenticateToken, getTemplateSetting);

// Toggle showInChat for a template
router.post('/toggle', authenticateToken, toggleShowInChat);

// Set/clear the default header media (image/video/document) for a template
router.post('/default-media', authenticateToken, setDefaultMedia);

// Set the post-send mode (no_change / agent / bot) for a template
router.post('/post-send-mode', authenticateToken, updatePostSendMode);

// Self-service add/edit/delete of the customer's OWN WhatsApp message templates,
// gated by `wa_templates_manage_enabled` (checked inside the controller).
router.post('/add', authenticateToken, addTemplate);
router.post('/edit', authenticateToken, editTemplate);
router.post('/delete', authenticateToken, deleteWaTemplate);

// Delete template setting
router.delete('/:templateName', authenticateToken, requireAdmin, deleteTemplateSetting);

export default router;


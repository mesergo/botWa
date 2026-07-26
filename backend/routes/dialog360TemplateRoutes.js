import express from 'express';
import { 
  getTemplateSettings,
  getTemplateSetting,
  toggleShowInChat,
  setDefaultMedia,
  deleteTemplateSetting
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

// Delete template setting
router.delete('/:templateName', authenticateToken, requireAdmin, deleteTemplateSetting);

export default router;

import express from 'express';
import { sendTemplateExternal } from '../controllers/chatController.js';

const router = express.Router();

// GET/POST /api/360/:wa_id/send — proxy + log template sends via dialog360
router.get('/:wa_id/send', sendTemplateExternal);
router.post('/:wa_id/send', sendTemplateExternal);

export default router;

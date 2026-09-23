import express from 'express';
import { sendTemplateExternal } from '../controllers/chatController.js';
import { updateMessageStatus } from '../controllers/statusWebhookController.js';

const router = express.Router();

// GET/POST /api/360/:wa_id/send — proxy + log template sends via dialog360
router.get('/:wa_id/send', sendTemplateExternal);
router.post('/:wa_id/send', sendTemplateExternal);

// POST /api/360/status — receives delivery-status webhooks forwarded from dialog360.js
router.post('/status', updateMessageStatus);

export default router;

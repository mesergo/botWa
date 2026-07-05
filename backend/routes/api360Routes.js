import express from 'express';
import { sendTemplateExternal } from '../controllers/chatController.js';

const router = express.Router();

/**
 * GET  /api/360/:wa_id/send
 * POST /api/360/:wa_id/send
 *
 * Public endpoint — sends a WhatsApp template message and records it in the
 * contact's conversation history.
 *
 * Parameters (query string for GET, body for POST):
 *   phone     - destination phone number
 *   template  - template name
 *   token     - SHA1(wa_id + 'moomoo')
 *   language  - template language code (default: "he")
 *   params[0], params[1], … - template body variable substitutions
 *
 * Example GET:
 *   /api/360/MY_WA_ID/send?phone=972501234567&template=hello_world&token=abc...&params[0]=John
 */
router.get('/:wa_id/send', sendTemplateExternal);
router.post('/:wa_id/send', sendTemplateExternal);

export default router;

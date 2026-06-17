import express from 'express';
import { respondToMessage } from '../controllers/chatController.js';

const router = express.Router();

// GET /api/chat/get-reply-text
// Query: ?phone=972733456080&token=<public_id>&text=xxx&sender=0548505808
router.get('/get-reply-text', respondToMessage);

// POST /api/chat/get-reply-text — same handler, called by dialog360 after media upload
// Body (form-encoded or JSON): token, text (media URL or plain text), sender
router.post('/get-reply-text', respondToMessage);

// Legacy POST endpoint (keep for backward compatibility)
router.post('/respond', respondToMessage);

export default router;

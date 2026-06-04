import express from 'express';
import { verifyWebhook, receiveWebhook } from '../controllers/whatsappWebhookController.js';

const router = express.Router();

// Public — both endpoints are called by Meta, not by our users.
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

export default router;

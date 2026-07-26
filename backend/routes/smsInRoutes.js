import express from 'express';
import { getMessages, getAdminMessages, createMessage } from '../sms-in/controllers/messages.controller.js';
import { getStatus } from '../sms-in/controllers/status.controller.js';
import { getClients } from '../sms-in/controllers/clients.controller.js';
import { getDestSettings, getAdminDestSettings, upsertDestSetting } from '../sms-in/controllers/destSettings.controller.js';
import { authenticateToken, requireAdmin, optionalAuthToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', getStatus);
// Optional auth so we can scope messages to the logged-in customer
router.get('/messages', optionalAuthToken, getMessages);
// Management panel — full inbox (DB-verified admin)
router.get('/admin/messages', authenticateToken, requireAdmin, getAdminMessages);
router.post('/messages', createMessage);
router.get('/clients', authenticateToken, requireAdmin, getClients);
router.get('/dest-settings', authenticateToken, getDestSettings);
router.get('/admin/dest-settings', authenticateToken, requireAdmin, getAdminDestSettings);
router.put('/dest-settings/:dest', authenticateToken, requireAdmin, upsertDestSetting);

export default router;

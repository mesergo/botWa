import express from 'express';
import { getMessages, getAdminMessages, createMessage, getDests, getAdminDests } from '../sms-in/controllers/messages.controller.js';
import { getStatus } from '../sms-in/controllers/status.controller.js';
import { getClients } from '../sms-in/controllers/clients.controller.js';
import { getDestSettings, getAdminDestSettings, upsertDestSetting, bulkAssignDestSettings } from '../sms-in/controllers/destSettings.controller.js';
import { createExternalLog } from '../sms-in/controllers/externalLog.controller.js';
import { authenticateToken, requireAdmin, optionalAuthToken, requireApiKey } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', getStatus);
// Optional auth so we can scope messages to the logged-in customer
router.get('/messages', optionalAuthToken, getMessages);
// Dest numbers that actually have messages — powers the dest-filter dropdown
router.get('/messages/dests', optionalAuthToken, getDests);
// Management panel — full inbox (DB-verified admin)
router.get('/admin/messages', authenticateToken, requireAdmin, getAdminMessages);
router.get('/admin/messages/dests', authenticateToken, requireAdmin, getAdminDests);
router.post('/messages', createMessage);
// Called by the external "maskyoo" project — stores a copy in our own MongoDB
// (collection: sms), separate from the external ilbot SMS DB above.
router.post('/external-log', requireApiKey, createExternalLog);
router.get('/clients', authenticateToken, requireAdmin, getClients);
router.get('/dest-settings', authenticateToken, getDestSettings);
router.get('/admin/dest-settings', authenticateToken, requireAdmin, getAdminDestSettings);
router.put('/dest-settings/:dest', authenticateToken, requireAdmin, upsertDestSetting);
router.post('/admin/dest-settings/bulk-assign', authenticateToken, requireAdmin, bulkAssignDestSettings);

export default router;

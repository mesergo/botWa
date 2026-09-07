import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { listErrorLogs, getErrorLogMeta, reportClientError } from './errorLog.controller.js';

const router = express.Router();

// Ingestion endpoint — deliberately NOT gated by authenticateToken (a client can
// hit an error while logged out); attribution is resolved internally when a
// Bearer token is present. Must be declared before the admin-only guard below.
router.post('/report', reportClientError);

// Everything else is admin-only, viewed from the "תיעוד שגיאות" tab.
router.use(authenticateToken, requireAdmin);
router.get('/', listErrorLogs);
router.get('/meta', getErrorLogMeta);

export default router;

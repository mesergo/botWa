
import express from 'express';
import { startSession, updateSessionParameters, getContacts, getUserSessions, getAllSessions } from '../controllers/sessionController.js';
import { authenticateToken, optionalAuthToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Authenticated route to get all contacts
router.get('/contacts', authenticateToken, getContacts);

// Authenticated route to get sessions for the current user
router.get('/my-sessions', authenticateToken, getUserSessions);

// Admin route to get all sessions in the system
router.get('/all-sessions', authenticateToken, requireAdmin, getAllSessions);

// Public routes for simulator usage - optionalAuthToken stores user_id when token is present
router.post('/start', optionalAuthToken, startSession);
router.post('/update-parameters', updateSessionParameters);
export default router;

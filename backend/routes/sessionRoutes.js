
import express from 'express';
import { startSession, updateSessionParameters, addHistoryMessage, getContacts, getUserSessions, getAllSessions, toggleSessionActive, deactivateSession } from '../controllers/sessionController.js';
import { authenticateToken, optionalAuthToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Authenticated route to get all contacts
router.get('/contacts', authenticateToken, getContacts);

// Authenticated route to get sessions for the current user
router.get('/my-sessions', authenticateToken, getUserSessions);

// Admin route to get all sessions in the system
router.get('/all-sessions', authenticateToken, requireAdmin, getAllSessions);

// Admin route to toggle session active state
router.patch('/:id/toggle-active', authenticateToken, requireAdmin, toggleSessionActive);

// Public routes for simulator usage - optionalAuthToken stores user_id when token is present
router.post('/start', optionalAuthToken, startSession);
router.post('/update-parameters', updateSessionParameters);
router.post('/add-history', addHistoryMessage);
router.patch('/:id/deactivate', deactivateSession);
export default router;

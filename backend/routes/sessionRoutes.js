
import express from 'express';
import { startSession, updateSessionParameters, addHistoryMessage, getContacts, getSessionsByPhone, getUserSessions, getAllSessions, toggleSessionActive, deactivateSession, setAgentMode, clearAgentMode, sendAgentMessage, sendExternalMessage, getSessionMessages } from '../controllers/sessionController.js';
import { authenticateToken, optionalAuthToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Authenticated route to get all contacts
router.get('/contacts', authenticateToken, getContacts);

// Authenticated route to get all sessions for a specific phone number (oldest→newest)
router.get('/by-phone', authenticateToken, getSessionsByPhone);

// Authenticated route to get sessions for the current user
router.get('/my-sessions', authenticateToken, getUserSessions);

// Admin route to get all sessions in the system
router.get('/all-sessions', authenticateToken, requireAdmin, getAllSessions);

// Admin route to toggle session active state
router.patch('/:id/toggle-active', authenticateToken, requireAdmin, toggleSessionActive);

// Agent mode routes
router.patch('/:id/set-agent', authenticateToken, setAgentMode);
router.patch('/:id/clear-agent', authenticateToken, clearAgentMode);
router.post('/:id/send-agent-message', authenticateToken, sendAgentMessage);

// Public routes for simulator usage - optionalAuthToken stores user_id when token is present
router.post('/start', optionalAuthToken, startSession);
router.post('/update-parameters', updateSessionParameters);
router.post('/add-history', addHistoryMessage);
router.patch('/:id/deactivate', deactivateSession);

// External message routes (for Filament or web service responses)
router.post('/send-message', sendExternalMessage);
router.get('/:sessionId/messages', getSessionMessages);

export default router;

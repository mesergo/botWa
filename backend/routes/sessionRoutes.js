
import express from 'express';
import { startSession, updateSessionParameters, addHistoryMessage, getContacts, getSessionsByPhone, getUserSessions, getAllSessions, toggleSessionActive, deactivateSession, setAgentMode, clearAgentMode, closeConversation, markResolved, sendAgentMessage, sendAdminMessageToSession, sendExternalMessage, getSessionMessages, sendTemplateToPhone, transferConversation, getTransferTargets, streamEvents, getUserStats } from '../controllers/sessionController.js';
import { authenticateToken, optionalAuthToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// SSE: real-time push stream (token auth via query param — EventSource can't set headers)
router.get('/stream', streamEvents);

// Authenticated route to get dashboard statistics for the current user
router.get('/stats', authenticateToken, getUserStats);

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
router.patch('/:id/close-conversation', authenticateToken, closeConversation);
router.patch('/:id/mark-resolved', authenticateToken, markResolved);
router.patch('/:id/transfer', authenticateToken, transferConversation);
router.get('/transfer-targets', authenticateToken, getTransferTargets);
router.post('/:id/send-agent-message', authenticateToken, sendAgentMessage);

// Send a template to a phone number with no session
router.post('/send-template-to-phone', authenticateToken, sendTemplateToPhone);

// Admin route to send message to any session + activate agent mode
router.post('/admin-send-message', authenticateToken, requireAdmin, sendAdminMessageToSession);

// Public routes for simulator usage - optionalAuthToken stores user_id when token is present
router.post('/start', optionalAuthToken, startSession);
router.post('/update-parameters', updateSessionParameters);
router.post('/add-history', addHistoryMessage);
router.patch('/:id/deactivate', deactivateSession);

// External message routes (for Filament or web service responses)
router.post('/send-message', sendExternalMessage);
router.get('/:sessionId/messages', getSessionMessages);

export default router;

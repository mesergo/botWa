
import express from 'express';
import { startSession, updateSessionParameters, getContacts } from '../controllers/sessionController.js';
import { authenticateToken, optionalAuthToken } from '../middleware/auth.js';

const router = express.Router();

// Authenticated route to get all contacts
router.get('/contacts', authenticateToken, getContacts);

// Public routes for simulator usage - optionalAuthToken stores user_id when token is present
router.post('/start', optionalAuthToken, startSession);
router.post('/update-parameters', updateSessionParameters);
export default router;

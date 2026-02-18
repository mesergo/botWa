
import express from 'express';
import { startSession, updateSessionParameters } from '../controllers/sessionController.js';

const router = express.Router();

// Public routes for simulator usage
router.post('/start', startSession);
router.post('/update-parameters', updateSessionParameters);
export default router;

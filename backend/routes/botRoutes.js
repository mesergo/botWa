
import express from 'express';
import { createBot, getBots, deleteBot, setDefaultBot, updateBotParams, connectFacebook, facebookCallback, facebookIngest, facebookRedirect, issueFacebookState, issueFacebookStateFree, updateBotPublicId, updateBotEndpoint } from '../controllers/botController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, createBot);
router.get('/', authenticateToken, getBots);
router.delete('/:id', authenticateToken, deleteBot);
router.patch('/:id/set-default', authenticateToken, setDefaultBot);
router.patch('/:id/params', authenticateToken, updateBotParams);
router.post('/:id/connect-facebook', authenticateToken, connectFacebook);
router.post('/:id/facebook-callback', authenticateToken, facebookCallback);
router.post('/:id/facebook-ingest', authenticateToken, facebookIngest);
router.get('/:id/facebook-redirect-state', authenticateToken, issueFacebookState);
router.get('/facebook-redirect-state-free', authenticateToken, issueFacebookStateFree);
// Public — Meta redirects the browser here after Embedded Signup completes.
// Auth is carried in the signed `state` query param, not in headers.
router.get('/facebook-redirect', facebookRedirect);
router.patch('/:id/public-id', authenticateToken, updateBotPublicId);
router.patch('/:id/endpoint', authenticateToken, updateBotEndpoint);

export default router;

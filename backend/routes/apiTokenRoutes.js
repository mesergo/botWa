import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { listApiTokens, createApiToken, deleteApiToken } from '../controllers/apiTokenController.js';

const router = express.Router();

router.get('/', authenticate, listApiTokens); // List this account's API tokens
router.post('/', authenticate, createApiToken); // Create a new named API token (optional expiry)
router.delete('/:id', authenticate, deleteApiToken); // Revoke/delete a token

export default router;

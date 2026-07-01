import express from 'express';
import { authenticateJwtOrApiToken } from '../middleware/auth.js';
import {
  activateNumber,
  fetchAndActivate,
  linkNumber,
  listConnectedNumbers,
  assignToBot,
  unassignFromBot,
  markRegistered,
  createPhpAccount
} from '../controllers/whatsappRegistrationController.js';

const router = express.Router();

// All routes accept either a dashboard JWT or the user's api_token (User.token)
// as `Authorization: Bearer <...>`.

// Stage 2: activate phone number on Meta (no DB writes).
router.post('/activate-number', authenticateJwtOrApiToken, activateNumber);

// Fetch WABA phone numbers from Meta then activate + upsert each one.
router.post('/fetch-and-activate', authenticateJwtOrApiToken, fetchAndActivate);

// Stage 3: link an activated number to the user's account (no bot yet).
router.post('/link-number', authenticateJwtOrApiToken, linkNumber);

// Settings UI: list / assign / unassign connected numbers.
router.get('/connected-numbers', authenticateJwtOrApiToken, listConnectedNumbers);
router.post('/assign-to-bot', authenticateJwtOrApiToken, assignToBot);
router.post('/unassign-from-bot', authenticateJwtOrApiToken, unassignFromBot);
router.post('/mark-registered', authenticateJwtOrApiToken, markRegistered);

// Stage 5: provision external dialog360/accounts/users via facebook-create.php.
// Can be called standalone or chained after Stage 4 from the frontend.
router.post('/php-create', authenticateJwtOrApiToken, createPhpAccount);

export default router;

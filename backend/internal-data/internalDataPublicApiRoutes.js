import express from 'express';
import { lookupRecord, queryRecords } from './internalDataPublicApiController.js';

// Deliberately NOT behind authenticateToken — see internalDataPublicApiController.js
// for the per-table access check (public flag or api key).
const router = express.Router();

router.get('/:id/lookup', lookupRecord);
router.post('/:id/lookup', lookupRecord);
router.get('/:id/query', queryRecords);
router.post('/:id/query', queryRecords);

export default router;

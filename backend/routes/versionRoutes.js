
import express from 'express';
import { publishVersion, getVersions, deleteVersion, toggleVersionLock } from '../controllers/versionController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/publish', authenticateToken, publishVersion);
router.get('/', authenticateToken, getVersions);
router.patch('/:id/lock', authenticateToken, toggleVersionLock);
router.delete('/:id', authenticateToken, deleteVersion);

export default router;


import express from 'express';
import { publishVersion, publishPaidVersion, getVersions, deleteVersion, toggleVersionLock, getRestorableVersions, restoreVersion } from '../controllers/versionController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/publish', authenticateToken, publishVersion);
router.post('/publish-paid', authenticateToken, publishPaidVersion);
router.get('/', authenticateToken, getVersions);
router.get('/restorable', authenticateToken, getRestorableVersions);
router.post('/:id/restore', authenticateToken, restoreVersion);
router.patch('/:id/lock', authenticateToken, toggleVersionLock);
router.delete('/:id', authenticateToken, deleteVersion);

export default router;

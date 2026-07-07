import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroup,
  addMembers,
  removeMember,
  addToBlocklist,
  sendToGroup,
  listBroadcasts,
  getBroadcast,
  resumeBroadcast,
  cancelBroadcast,
  listRemovals,
} from '../controllers/groupController.js';
 
const router = express.Router();
router.use(authenticateToken);

// Specific routes first
router.post('/blocklist/add', addToBlocklist);
router.get('/broadcasts', listBroadcasts);
router.get('/broadcasts/:id', getBroadcast);
router.post('/broadcasts/:id/resume', resumeBroadcast);
router.delete('/broadcasts/:id/cancel', cancelBroadcast);
router.get('/removals/log', listRemovals);

router.get('/', listGroups);
router.post('/', createGroup);
router.get('/:id', getGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);

router.post('/:id/members', addMembers);
router.delete('/:id/members/:contactId', removeMember);

router.post('/:id/broadcast', sendToGroup);

export default router;

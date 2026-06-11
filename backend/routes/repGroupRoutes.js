import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getRepGroups, getRepGroup, createRepGroup, updateRepGroup, deleteRepGroup, getRepsForGroups } from '../controllers/repGroupController.js';

const router = express.Router();

// Allow company managers (role=user), rep_managers, and admins
router.use(authenticateToken, (req, res, next) => {
  const role = req.user?.role;
  if (role === 'user' || role === 'admin' || role === 'rep_manager' || req.user?.isImpersonating) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied.' });
});

router.get('/', getRepGroups);
router.get('/reps', getRepsForGroups);
router.get('/:id', getRepGroup);
router.post('/', createRepGroup);
router.patch('/:id', updateRepGroup);
router.delete('/:id', deleteRepGroup);

export default router;

import express from 'express';
import { authenticateToken, resolvePermissions, hasPermission } from '../middleware/auth.js';
import { getRepGroups, getRepGroup, createRepGroup, updateRepGroup, deleteRepGroup, getRepsForGroups } from '../controllers/repGroupController.js';

const router = express.Router();

// Allow company managers (role=user), rep_managers, admins, and users with rep_groups.view or users.view permission
router.use(authenticateToken, async (req, res, next) => {
  const role = req.user?.role;
  if (role === 'user' || role === 'admin' || role === 'rep_manager' || req.user?.isImpersonating) {
    return next();
  }
  // Also allow users whose custom user type grants rep_groups.view or users.view permission
  try {
    const perms = await resolvePermissions(req.user);
    if (hasPermission(perms, 'rep_groups.view') || hasPermission(perms, 'users.view')) {
      return next();
    }
  } catch (_) {}
  return res.status(403).json({ error: 'Access denied.' });
});

router.get('/', getRepGroups);
router.get('/reps', getRepsForGroups);
router.get('/:id', getRepGroup);
router.post('/', createRepGroup);
router.patch('/:id', updateRepGroup);
router.delete('/:id', deleteRepGroup);

export default router;

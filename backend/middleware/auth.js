import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const SECRET_KEY = 'dfghjukiolp;[p0o9i8uytgbhnjmk,l.;p9876543t4rre2asd';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    req.userId = user.id; // Add userId for easier access
    next();
  });
};

// Returns the effective owner user ID:
// For rep roles (rep / rep_manager / rep_bot), returns their manager's ID so they see the manager's data.
// For all other roles, returns the authenticated user's own ID.
export const getEffectiveUserId = (req) => {
  const role = req.user?.role;
  if ((role === 'rep' || role === 'rep_manager' || role === 'rep_bot') && req.user?.manager_id) {
    return req.user.manager_id;
  }
  return req.userId;
};

// Middleware: only company managers (role === 'user') may access this route.
// Also allows admins who are impersonating a company manager.
export const requireCompanyManager = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ error: 'Access denied. Company manager role required.' });
  }
  const role = req.user.role;
  // Allow: company manager, OR admin impersonating someone
  if (role === 'user' || role === 'admin' || req.user.isImpersonating) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Company manager role required.' });
};

// Middleware: company managers AND rep_managers may access this route.
export const requireManagerOrRepManager = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const role = req.user.role;
  if (role === 'user' || role === 'admin' || role === 'rep_manager' || req.user.isImpersonating) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied.' });
};

// Middleware to check if user is admin
export const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Alias for authenticate
export const authenticate = authenticateToken;

// Optional auth - sets req.user if token is valid, but doesn't block if no token
export const optionalAuthToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (!err) {
      req.user = user;
      req.userId = user.id;
    }
    next();
  });
};

export { SECRET_KEY };
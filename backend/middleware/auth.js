import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UserType from '../models/UserType.js';

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

// Accepts either a JWT (signed by SECRET_KEY) OR a raw User.token (api_token).
// Used by external-integration endpoints that may be called from the dashboard
// (JWT) or from third-party systems holding the user's permanent api_token.
export const authenticateJwtOrApiToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'missing_token' });

  // Try JWT first (cheap, no DB)
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    req.userId = decoded.id;
    return next();
  } catch (_) { /* fall through to api_token lookup */ }

  try {
    const user = await User.findOne({ token });
    if (!user) return res.status(403).json({ error: 'invalid_token' });
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role || 'user',
      manager_id: user.manager_id || null,
      authMethod: 'api_token'
    };
    req.userId = req.user.id;
    return next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export { SECRET_KEY };
/**
 * Resolves the effective permissions object for a user.
 * Loads the UserType document if user_type_id is set, otherwise falls back
 * to the built-in role defaults (backward compatibility with existing users).
 */
export const resolvePermissions = async (user) => {
  if (user.user_type_id) {
    const userType = await UserType.findById(user.user_type_id).lean();
    if (userType) return userType.permissions || {};
  }
  // Fallback: look up the seeded UserType matching the user's role.
  // This ensures changes made in the UserTypesManager panel take effect
  // even for users who don't have an explicit user_type_id set.
  if (user.role) {
    const seededType = await UserType.findOne({ system_role: user.role, is_seeded: true }).lean();
    if (seededType) return seededType.permissions || {};
  }
  // Final fallback: hardcoded defaults (legacy backward-compat)
  return getDefaultPermissionsForRole(user.role);
};

/**
 * Returns a permission sub-object for a dot-separated key, e.g. 'sessions.view_all'.
 * Usage in a controller: const perms = await resolvePermissions(user); hasPermission(perms, 'sessions.view_all')
 */
export const hasPermission = (permissions, key) => {
  if (!permissions || !key) return false;
  const [section, action] = key.split('.');
  return !!permissions?.[section]?.[action];
};

/** Fallback permissions based on legacy role string */
function getDefaultPermissionsForRole(role) {
  const all = {
    bots:     { view_tab: true, create: true, edit: true, delete: true, settings: true, publish: true },
    sessions: { view: true, add: true, view_all: true, view_assigned_only: true, templates_as_rep: true, templates_as_manager: true },
    contacts: { view: true, add: true, edit: true, delete: true, import_excel: true },
    groups:   { view: true, create: true, add_contact: true, send_message: true, remove_contact: true },
    settings: { view: true, edit_profile: true },
    users:    { view: true, add: true, edit: true, delete: true },
    rep_groups: { view: true, add: true, delete: true }
  };
  const none = {
    bots:     { view_tab: false, create: false, edit: false, delete: false, settings: false, publish: false },
    sessions: { view: false, add: false, view_all: false, view_assigned_only: false, templates_as_rep: false, templates_as_manager: false },
    contacts: { view: false, add: false, edit: false, delete: false, import_excel: false },
    groups:   { view: false, create: false, add_contact: false, send_message: false, remove_contact: false },
    settings: { view: false, edit_profile: false },
    users:    { view: false, add: false, edit: false, delete: false },
    rep_groups: { view: false, add: false, delete: false }
  };
  if (role === 'admin') return all;
  if (role === 'user') return all;
  if (role === 'rep_manager') return {
    bots:     { ...none.bots },
    sessions: { view: true, add: true, view_all: true, view_assigned_only: false, templates_as_rep: false, templates_as_manager: true },
    contacts: { view: true, add: true, edit: true, delete: false, import_excel: false },
    groups:   { view: true, create: false, add_contact: false, send_message: true, remove_contact: false },
    settings: { view: true, edit_profile: true },
    users:    { ...none.users },
    rep_groups: { ...none.rep_groups }
  };
  // rep (default)
  return {
    bots:     { ...none.bots },
    sessions: { view: true, add: false, view_all: false, view_assigned_only: true, templates_as_rep: true, templates_as_manager: false },
    contacts: { view: true, add: false, edit: false, delete: false, import_excel: false },
    groups:   { view: true, create: false, add_contact: false, send_message: false, remove_contact: false },
    settings: { view: true, edit_profile: true },
    users:    { ...none.users },
    rep_groups: { ...none.rep_groups }
  };
}

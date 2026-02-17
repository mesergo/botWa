import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const SECRET_KEY = 'flowbot-secure-jwt-key';

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

export { SECRET_KEY };
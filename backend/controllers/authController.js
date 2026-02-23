
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../middleware/auth.js';

export const register = async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  try {
    const publicId = Math.random().toString(36).substring(2, 15);
    
    // Check if role=admin was requested
    let userRole = 'user';
    if (role === 'admin') {
      // Allow admin creation if:
      // 1. It's the first user in the system (no admins exist)
      // 2. Or in development environment
      const adminCount = await User.countDocuments({ role: 'admin' });
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (adminCount === 0 || isDevelopment) {
        userRole = 'admin';
        console.log(`✅ Creating admin user: ${email} (First admin: ${adminCount === 0}, Dev mode: ${isDevelopment})`);
      } else {
        console.log(`⚠️ Attempted admin creation denied for ${email} - admins already exist in production`);
      }
    }
    
    // Set trial expiry date (1 month from now)
    const trialExpiresAt = new Date();
    trialExpiresAt.setMonth(trialExpiresAt.getMonth() + 1);

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: userRole,
      public_id: publicId,
      account_type: 'Trial',
      status: 'active',
      trial_expires_at: trialExpiresAt
    });
    
    const userId = user._id.toString();
    const jwtToken = jwt.sign({ id: userId, email }, SECRET_KEY);
    
    // Return both JWT token (for dashboard) and API token (for WhatsApp)
    res.json({ 
      token: jwtToken, 
      user: { 
        id: userId, 
        name, 
        email, 
        role: 'user',
        public_id: publicId, 
        account_type: 'Trial', 
        status: 'active',
        trial_expires_at: user.trial_expires_at,
        api_token: user.token // API token for WhatsApp integration
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const userId = user._id.toString();
    const jwtToken = jwt.sign({ id: userId, email: user.email }, SECRET_KEY);
    
    res.json({ 
      token: jwtToken, 
      user: { 
        id: userId, 
        name: user.name, 
        email: user.email, 
        role: user.role || 'user',
        public_id: user.public_id,
        account_type: user.account_type || 'Basic',
        status: user.status || 'active',
        trial_expires_at: user.trial_expires_at || null,
        api_token: user.token // API token for WhatsApp integration
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check if email already exists in the system
export const checkEmail = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    res.json({ exists: !!existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get API token for authenticated user
export const getApiToken = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      api_token: user.token,
      usage_example: `http://localhost:3001/api/chat/get-reply-text?phone=PHONE&token=${user.token}&text=MESSAGE&sender=SENDER`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

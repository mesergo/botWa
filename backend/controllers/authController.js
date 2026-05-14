
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

// Google OAuth login/register
export const googleAuth = async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      const trialExpiresAt = new Date();
      trialExpiresAt.setMonth(trialExpiresAt.getMonth() + 1);
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        public_id: Math.random().toString(36).substring(2, 15),
        account_type: 'Trial',
        status: 'active',
        trial_expires_at: trialExpiresAt,
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const jwtToken = jwt.sign({ id: user._id.toString(), email: user.email }, SECRET_KEY);
    res.json({
      token: jwtToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        public_id: user.public_id,
        account_type: user.account_type || 'Trial',
        status: user.status || 'active',
        trial_expires_at: user.trial_expires_at || null,
        api_token: user.token,
      },
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'אימות גוגל נכשל, נסה שנית' });
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

// Get Dialog360 templates for authenticated user
export const getTemplates = async (req, res) => {
  try {
    console.log('[Dialog360] getTemplates called, userId:', req.userId);
    
    const userId = req.userId; // From auth middleware
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('[Dialog360] User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('[Dialog360] User found:', user.email);
    console.log('[Dialog360] Bot ID from DB:', user.dialog360_bot_id);
     
    if (!user.dialog360_bot_id) {
      console.warn('[Dialog360] Bot ID not configured for user:', user.email);
      return res.status(400).json({ 
        error: 'Dialog360 Bot ID not configured. Please set Bot ID in user settings.',
        success: false 
      });
    }
    
    // Build endpoint URL and token from bot_id
    const botId = user.dialog360_bot_id;
    const endpoint = `https://app.chatgo.live/api/dialog360/${botId}/message_templates`;
    
    // Generate SHA1 token: SHA1(bot_id + "moomoo")
    const crypto = await import('crypto');
    const token = crypto.createHash('sha1').update(botId + 'moomoo').digest('hex');
    
    console.log('[Dialog360] Fetching from endpoint:', endpoint);
    console.log('[Dialog360] Generated token:', token.substring(0, 10) + '...');
    
    // Fetch templates from Dialog360
    const response = await fetch(endpoint, {
      headers: {
        "token": token
      }
    });
    
    console.log('[Dialog360] Response status:', response.status);
    console.log('[Dialog360] Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Dialog360] API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `Dialog360 API returned status ${response.status}: ${errorText}`,
        success: false
      });
    }
    
    const data = await response.json();
    console.log('[Dialog360] Response data keys:', Object.keys(data));
    console.log('[Dialog360] data.data length:', data.data?.length || 0);
    console.log('[Dialog360] First template:', data.data?.[0]?.name || 'N/A');
    
    res.json({ 
      templates: data,
      success: true 
    });
    
  } catch (err) {
    console.error('[Dialog360] Error fetching templates:', err);
    res.status(500).json({ 
      error: err.message,
      success: false 
    });
  }
};

// Update Dialog360 Bot ID for authenticated user
export const updateDialog360Credentials = async (req, res) => {
  try {
    const userId = req.userId;
    const { dialog360_bot_id } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        dialog360_bot_id: dialog360_bot_id || ''
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'Dialog360 Bot ID updated successfully',
      dialog360_bot_id: user.dialog360_bot_id
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

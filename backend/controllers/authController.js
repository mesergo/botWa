
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../middleware/auth.js';

export const register = async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const publicId = Math.random().toString(36).substring(2, 15);
    const user = await User.create({
      name,
      email, 
      phone,
      password,
      role: 'user',
      public_id: publicId,
      account_type: 'Basic',
      status: 'active'
    });
    
    const userId = user._id.toString();
    const token = jwt.sign({ id: userId, email }, SECRET_KEY);
    res.json({ token, user: { id: userId, name, email, public_id: publicId, account_type: 'Basic', status: 'active' } });
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
    const token = jwt.sign({ id: userId, email: user.email }, SECRET_KEY);
    res.json({ token, user: { 
      id: userId, 
      name: user.name, 
      email: user.email, 
      public_id: user.public_id,
      account_type: user.account_type || 'Basic',
      status: user.status || 'active'
    } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

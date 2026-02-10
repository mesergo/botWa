import mongoose from 'mongoose';
import User from './models/User.js';

async function checkUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/bots');
    console.log('✅ Connected to MongoDB');

    // Find user with the token
    const token = '75d33570c726b43ec0b3a06e1057a9c66329d88e3748c2107e38f878e9a76a29';
    const user = await User.findOne({ token });
    
    if (!user) {
      console.log('❌ User not found with token');
      console.log('\nAll users:');
      const allUsers = await User.find({});
      allUsers.forEach(u => {
        console.log({
          id: u._id.toString(),
          username: u.username,
          phone: u.phone,
          token: u.token
        });
      });
      return;
    }

    console.log('✅ Found user:', {
      id: user._id.toString(),
      username: user.username,
      phone: user.phone,
      token: user.token
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkUser();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/botWa';

async function listUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all users
    const users = await User.find({}).select('-password');
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      process.exit(0);
    }

    console.log(`Found ${users.length} user(s):\n`);
    console.log('─'.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role || 'user'} ${user.role === 'admin' ? '👑' : ''}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString('he-IL') : 'N/A'}`);
      console.log('─'.repeat(80));
    });

    console.log(`\nTo make a user admin, run: node make-admin.js <email>`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

listUsers();

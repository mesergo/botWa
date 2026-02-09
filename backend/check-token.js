import mongoose from 'mongoose';
import User from './models/User.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/bots';

async function checkToken() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const token = '75d33570c726b43ec0b3a06e1057a9c66329d88e3748c2107e38f878e9a76a29';
    console.log('🔑 Checking token:', token);

    const user = await User.findOne({ token });
    
    if (user) {
      console.log('\n✅ User found!');
      console.log(`   ID: ${user._id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
    } else {
      console.log('\n❌ No user found with this token!');
      console.log('\n📋 All users:');
      const allUsers = await User.find();
      allUsers.forEach(u => {
        console.log(`   - ${u.name} (${u.email})`);
        console.log(`     Token: ${u.token || 'NO TOKEN'}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkToken();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import User from './models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bots';

async function updateExistingUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users without a token
    const usersWithoutToken = await User.find({ 
      $or: [
        { token: { $exists: false } },
        { token: null },
        { token: '' }
      ]
    });

    console.log(`\n📊 Found ${usersWithoutToken.length} users without API token\n`);

    if (usersWithoutToken.length === 0) {
      console.log('✅ All users already have API tokens!');
      process.exit(0);
    }

    for (const user of usersWithoutToken) {
      // Generate unique token
      let tokenIsUnique = false;
      let newToken;
      
      while (!tokenIsUnique) {
        newToken = crypto.randomBytes(32).toString('hex');
        const existing = await User.findOne({ token: newToken });
        if (!existing) {
          tokenIsUnique = true;
        }
      }

      user.token = newToken;
      await user.save();

      console.log(`✅ Updated user: ${user.email}`);
      console.log(`   Token: ${newToken}`);
      console.log(`   URL: http://localhost:3001/api/chat/get-reply-text?phone=PHONE&token=${newToken}&text=MESSAGE&sender=SENDER\n`);
    }

    console.log('🎉 All users updated successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateExistingUsers();

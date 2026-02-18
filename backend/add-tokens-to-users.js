import dotenv from 'dotenv';
import crypto from 'crypto';
import connectDB from './config/db.js';
import User from './models/User.js';

dotenv.config();

// Generate a unique token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function addTokensToUsers() {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Get all users
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log('❌ No users found in database!');
      process.exit(0);
    }

    console.log(`📋 Found ${users.length} user(s)\n`);

    let updatedCount = 0;

    for (const user of users) {
      console.log('═══════════════════════════════════════════════');
      console.log(`👤 User: ${user.name || user.username || user.email}`);
      console.log(`   Email: ${user.email}`);
      
      if (!user.token || user.token === 'undefined') {
        // Generate new token
        const newToken = generateToken();
        user.token = newToken;
        await user.save();
        
        console.log(`   ✅ NEW Token generated: ${newToken}`);
        updatedCount++;
      } else {
        console.log(`   ℹ️  Token already exists: ${user.token}`);
      }
      
      console.log('═══════════════════════════════════════════════\n');
    }

    console.log(`\n🎉 Done! Updated ${updatedCount} user(s) with new tokens.`);
    console.log(`\nRun 'node check-users-tokens.js' to see all tokens.\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addTokensToUsers();

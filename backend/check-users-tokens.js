import dotenv from 'dotenv';
import connectDB from './config/db.js';
import User from './models/User.js';
import BotFlow from './models/BotFlow.js';

dotenv.config();

async function checkUsersAndTokens() {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // Get all users
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log('❌ No users found in database!');
      process.exit(0);
    }

    console.log(`📋 Found ${users.length} user(s):\n`);

    for (const user of users) {
      console.log('═══════════════════════════════════════════════');
      console.log(`👤 User: ${user.name || user.username || user.email}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Token: ${user.token}`);
      console.log(`   Phone: ${user.phone || 'N/A'}`);
      
      // Get user's bots
      const bots = await BotFlow.find({ user_id: user._id });
      console.log(`\n   🤖 Bots (${bots.length}):`);
      
      if (bots.length === 0) {
        console.log('      ⚠️  No bots found for this user');
      } else {
        bots.forEach((bot, index) => {
          console.log(`      ${index + 1}. ${bot.name} (ID: ${bot._id})${bot.is_default ? ' ⭐ DEFAULT' : ''}`);
        });
      }
      
      console.log('\n   📝 Example API call:');
      console.log(`   https://botwa.message.co.il/api/chat/get-reply-text?phone=972548505808&token=${user.token}&text=שלום&sender=0548505808`);
      console.log('═══════════════════════════════════════════════\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUsersAndTokens();

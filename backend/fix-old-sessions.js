/**
 * Fix old sessions where sender was incorrectly set to customer_phone
 * This script updates sessions where sender = customer_phone (bot's number)
 * to swap them correctly (sender should be the user, not the bot)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BotSession from './models/BotSession.js';

dotenv.config();

async function fixOldSessions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowbot');
    console.log('✅ Connected to MongoDB');

    // First, let's see what we have in the last 10 sessions
    console.log('\n📊 Checking last 10 sessions...\n');
    const recentSessions = await BotSession.find({})
      .sort({ created_at: -1 })
      .limit(10)
      .select('sender customer_phone created_at');

    recentSessions.forEach((s, i) => {
      console.log(`${i + 1}. Session ${s._id}:`);
      console.log(`   sender: "${s.sender || 'NULL'}"`);
      console.log(`   customer_phone: "${s.customer_phone || 'NULL'}"`);
      console.log(`   created_at: ${s.created_at}`);
    });

    // Find sessions where sender looks like a bot number (starts with 1848 or similar)
    // These are likely incorrectly swapped
    const sessions = await BotSession.find({
      sender: { $regex: /^(1848|1849)/ }
    });

    console.log(`\n📊 Found ${sessions.length} sessions with bot-like sender numbers\n`);

    let fixed = 0;
    let skipped = 0;

    for (const session of sessions) {
      console.log(`\nSession ${session._id}:`);
      console.log(`  Before: sender="${session.sender}", customer_phone="${session.customer_phone}"`);
      
      // If sender looks like a bot number and customer_phone looks like a user number
      if (session.sender?.match(/^(1848|1849)/) && session.customer_phone?.match(/^972/)) {
        // Swap them
        const oldSender = session.sender;
        const oldPhone = session.customer_phone;
        
        session.sender = oldPhone;
        session.customer_phone = oldSender;
        
        await session.save();
        console.log(`  ✅ Fixed: sender="${session.sender}", customer_phone="${session.customer_phone}"`);
        fixed++;
      } else {
        console.log(`  ⏭️ Skipped (doesn't match pattern)`);
        skipped++;
      }
    }

    console.log(`\n\n🎉 Done!`);
    console.log(`✅ Fixed: ${fixed} sessions`);
    console.log(`⏭️ Skipped: ${skipped} sessions`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixOldSessions();

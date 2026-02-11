import mongoose from 'mongoose';
import User from './models/User.js';
import BotFlow from './models/BotFlow.js';
import Widget from './models/Widget.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/bots';

async function checkUserBots() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const userId = '69833f1b982d3ef6b8351b16';
    console.log('👤 Checking user:', userId);

    const bots = await BotFlow.find({ user_id: userId });
    console.log(`\n📊 Found ${bots.length} bots for this user:`);
    bots.forEach(bot => {
      console.log(`   - ${bot.name} (ID: ${bot._id}) ${bot.is_default ? '⭐ DEFAULT' : ''}`);
    });

    console.log(`\n📊 Checking widgets by flow_id:`);
    const flowId = '69834137982d3ef6b8351b3d';
    const widgets = await Widget.find({ flow_id: flowId });
    console.log(`   Flow ${flowId}: ${widgets.length} widgets`);
    widgets.forEach(w => {
      console.log(`     - ${w.type} (${w.id}): "${w.value}"`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserBots();

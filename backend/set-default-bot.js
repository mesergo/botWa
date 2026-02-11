import mongoose from 'mongoose';
import BotFlow from './models/BotFlow.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });

const setDefaultBot = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all bots
    const bots = await BotFlow.find({});
    
    if (bots.length === 0) {
      console.log('❌ No bots found');
      process.exit(0);
    }

    console.log('\n📋 Available bots:');
    bots.forEach((bot, index) => {
      console.log(`${index + 1}. ${bot.name} (ID: ${bot._id}) ${bot.is_default ? '⭐ DEFAULT' : ''}`);
    });

    // If you want to set a specific bot as default, change the index here
    // For example: const botIndexToSetAsDefault = 0; (first bot)
    const botIndexToSetAsDefault = 0;

    if (botIndexToSetAsDefault >= bots.length) {
      console.log('❌ Invalid bot index');
      process.exit(1);
    }

    const selectedBot = bots[botIndexToSetAsDefault];

    // Remove default from all bots of this user
    await BotFlow.updateMany(
      { user_id: selectedBot.user_id },
      { is_default: false }
    );

    // Set selected bot as default
    selectedBot.is_default = true;
    await selectedBot.save();

    console.log(`\n✅ Set "${selectedBot.name}" (${selectedBot._id}) as default bot`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

setDefaultBot();

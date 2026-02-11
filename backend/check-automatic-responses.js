import mongoose from 'mongoose';
import Widget from './models/Widget.js';
import Option from './models/Option.js';
import User from './models/User.js';
import BotFlow from './models/BotFlow.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bots';

async function checkAutomaticResponses() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by phone
    const phone = '972548505808';
    const user = await User.findOne({ phone });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User found:', { id: user._id.toString(), phone: user.phone, name: user.name });

    // Find user's bots
    const userBots = await BotFlow.find({ user_id: user._id.toString() });
    console.log(`🤖 Found ${userBots.length} bots for user`);

    if (userBots.length > 0) {
      const bot = userBots[0];
      console.log('Using bot:', { id: bot._id.toString(), name: bot.name });

      // Find automatic_responses widget
      const flowId = bot._id.toString();
      const widgets = await Widget.find({ 
        flow_id: flowId,
        type: 'automatic_responses'
      });

      console.log(`\n📋 Found ${widgets.length} automatic_responses widgets:`);
      
      for (const widget of widgets) {
        console.log('\n-------------------');
        console.log('Widget:', { id: widget.id, type: widget.type });
        console.log('Image file metadata:', widget.image_file);
        
        // Find options for this widget
        const options = await Option.find({ widget_id: widget.id });
        console.log(`\n🎯 Options (${options.length}):`);
        options.forEach((opt, i) => {
          console.log(`  [${i}] value: "${opt.value}", operator: "${opt.operator || 'eq'}", next: ${opt.next}`);
        });
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAutomaticResponses();

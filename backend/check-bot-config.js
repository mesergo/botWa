import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BotFlow from './models/BotFlow.js';
import User from './models/User.js';
import Widget from './models/Widget.js';
import Option from './models/Option.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bots';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('=== Checking Bot Configuration ===\n');
    
    // Find user
    const user = await User.findOne({ email: 'by@w.co.il' }).sort({ _id: -1 });
    console.log(`User: ${user.email} (ID: ${user._id})\n`);
    
    // Find all bots for this user
    const bots = await BotFlow.find({ user_id: user._id });
    console.log(`Total Bots: ${bots.length}\n`);
    
    for (const bot of bots) {
      console.log(`Bot: "${bot.name}"`);
      console.log(`  ID: ${bot._id}`);
      console.log(`  Is Default: ${bot.is_default}`);
      console.log(`  Created: ${bot.created_at}`);
      
      // Find widgets for this bot
      const widgets = await Widget.find({ flow_id: bot._id.toString() });
      console.log(`  Widgets: ${widgets.length}`);
      
      // Find automatic_responses
      const autoWidget = widgets.find(w => w.type === 'automatic_responses');
      if (autoWidget) {
        console.log(`  ✅ Has automatic_responses widget (ID: ${autoWidget.id})`);
        
        const options = await Option.find({ widget_id: autoWidget.id });
        console.log(`     Options: ${options.length}`);
        options.forEach((opt, i) => {
          console.log(`       ${i}: "${opt.value}" → next: ${opt.next}`);
        });
      } else {
        console.log(`  ❌ No automatic_responses widget`);
      }
      console.log('');
    }
    
    // Which bot is currently being used?
    const defaultBot = bots.find(b => b.is_default);
    if (defaultBot) {
      console.log(`\n🎯 Currently Active Bot: "${defaultBot.name}" (ID: ${defaultBot._id})`);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });

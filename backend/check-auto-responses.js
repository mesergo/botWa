import mongoose from 'mongoose';
import Widget from './models/Widget.js';
import Option from './models/Option.js';
import BotFlow from './models/BotFlow.js';

mongoose.connect('mongodb://127.0.0.1:27017/bots')
  .then(async () => {
    console.log('=== Checking Automatic Responses Configuration ===\n');
    
    // Find all bots
    const bots = await BotFlow.find({});
    console.log('Total bots:', bots.length);
    
    for (const bot of bots) {
      console.log(`\nBot: ${bot.name} (ID: ${bot._id}, flow_id for widgets: ${bot._id.toString()})`);
      
      // Find automatic_responses widget for this bot
      const autoWidgets = await Widget.find({ 
        flow_id: bot._id.toString(), 
        type: 'automatic_responses' 
      });
      
      console.log(`  Found ${autoWidgets.length} automatic_responses widgets`);
      
      for (const widget of autoWidgets) {
        console.log(`\n  Widget ID: ${widget.id}`);
        console.log(`  Flow ID: ${widget.flow_id}`);
        console.log(`  Value: ${widget.value}`);
        console.log(`  Image file metadata:`, JSON.stringify(widget.image_file, null, 2));
        
        // Get options for this widget
        const options = await Option.find({ widget_id: widget.id });
        console.log(`  Options from Option collection (${options.length}):`);
        options.forEach((opt, i) => {
          console.log(`    ${i}: value="${opt.value}", operator="${opt.operator}", next="${opt.next}"`);
        });
      }
    }
    
    process.exit();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

import mongoose from 'mongoose';
import User from './models/User.js';
import BotFlow from './models/BotFlow.js';
import Widget from './models/Widget.js';
import Option from './models/Option.js';

async function debug() {
  try {
    // Connect like the server does
    await mongoose.connect('mongodb://127.0.0.1:27017/bots');
    console.log('✅ Connected to MongoDB (bots database)');

    // Check all collections
    const allWidgets = await Widget.find({});
    console.log(`\n📦 Total widgets: ${allWidgets.length}`);
    
    const autoWidgets = allWidgets.filter(w => w.type === 'automatic_responses');
    console.log(`🔄 Automatic response widgets: ${autoWidgets.length}`);
    
    if (autoWidgets.length > 0) {
      console.log('\n=== First automatic_responses widget ===');
      const widget = autoWidgets[0];
      console.log('ID:', widget.id);
      console.log('Type:', widget.type);
      console.log('Flow ID:', widget.flow_id);
      console.log('User ID:', widget.user_id);
      console.log('Image file (metadata):', JSON.stringify(widget.image_file, null, 2));
      
      // Get options for this widget
      const options = await Option.find({ widget_id: widget.id });
      console.log(`\n📝 Options (${options.length}):`, options.map(o => ({
        value: o.value,
        operator: o.operator,
        next: o.next
      })));
    }
    
    const allUsers = await User.find({});
    console.log(`\n👥 Total users: ${allUsers.length}`);
    if (allUsers.length > 0) {
      console.log('First user:', {
        id: allUsers[0]._id.toString(),
        phone: allUsers[0].phone
      });
    }
    
    const allBots = await BotFlow.find({});
    console.log(`\n🤖 Total bots: ${allBots.length}`);
    if (allBots.length > 0) {
      console.log('First bot:', {
        id: allBots[0]._id.toString(),
        name: allBots[0].name,
        user_id: allBots[0].user_id
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debug();

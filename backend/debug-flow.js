import mongoose from 'mongoose';
import User from './models/User.js';
import BotFlow from './models/BotFlow.js';
import Widget from './models/Widget.js';

const token = '75d33570c726b43ec0b3a06e1057a9c66329d88e3748c2107e38f878e9a76a29';
const phone = '972548505808';

async function debug() {
  try {
    // Try diffxxxxxxxxxxxction strings
    const connStrings = [
      'mongodb://localhost:27017/bots',
      'mongodb://127.0.0.1:27017/bots',
      'mongodb://bots:b0t5bots@127.0.0.1/bots'
    ];
    
    let connected = false;
    for (const connStr of connStrings) {
      try {
        console.log('Trying:', connStr.replace(/:([^:@]{4})[^:@]*@/, ':$1***@'));
        await monxxxxxxxxxxxct(connStr);
        console.log('✅ Connected to MongoDB with:', connStr.replace(/:([^:@]{4})[^:@]*@/, ':$1***@'));
        connected = true;
        break;
      } catch (err) {
        console.log('❌ Failed');
      }
    }
    
    if (!connected) {
      console.log('Could not connect to any MongoDB');
      return;
    }

    // Check all widgets
    const allWidgets = await Widget.find({});
    console.log('📦 Total widgets:', allWidgets.length);
    
    const autoWidgets = allWidgets.filter(w => w.type === 'automatic_responses');
    console.log('🔄 Automatic response widgets:', autoWidgets.length);
    
    if (autoWidgets.length > 0) {
      console.log('First automatic_responses widget:');
      const widget = autoWidgets[0];
      console.log({
        id: widget.id,
        type: widget.type,
        flow_id: widget.flow_id,
        user_id: widget.user_id,
        image_file: widget.image_file
      });
    }
    
    // Check all users
    const allUsers = await User.find({});
    console.log('👥 Total users:', allUsers.length);
    
    // Check all bots
    const allBots = await BotFlow.find({});
    console.log('🤖 Total bots:', allBots.length);
    
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

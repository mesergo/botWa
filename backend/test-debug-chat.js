import mongoose from 'mongoose';
import User from './models/User.js';
import BotFlow from './models/BotFlow.js';
import Widget from './models/Widget.js';
import Option from './models/Option.js';
import BotSession from './models/BotSession.js';

async function debugChat() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/bots');
    console.log('✅ Connected to MongoDB');

    const token = '75d33570c726b43ec0b3a06e1057a9c66329d88e3748c2107e38f878e9a76a29';
    const phone = '972548505808';
    const sender = '0548505808';

    // Find user
    const user = await User.findOne({ token });
    if (!user) {
      console.log('❌ User not found with token');
      process.exit(1);
    }
    console.log('✅ User found:', user._id);

    // Find user's bots
    const userBots = await BotFlow.find({ user_id: user._id });
    console.log(`✅ Found ${userBots.length} bots:`, userBots.map(b => ({ id: b._id, name: b.name })));

    if (userBots.length === 0) {
      console.log('❌ No bots found');
      process.exit(1);
    }

    const bot = userBots[0];
    console.log('Using bot:', { id: bot._id, name: bot.name });

    // Get flow data
    const flowId = bot._id.toString();
    console.log('Flow ID:', flowId, 'Type:', typeof flowId);

    // Query widgets
    const query = {
      flow_id: flowId,
      $or: [{ standard_process_id: null }, { isStandardProcess: 1 }]
    };
    console.log('Query:', JSON.stringify(query));

    const widgets = await Widget.find(query);
    console.log(`\n✅ Found ${widgets.length} widgets:`);
    widgets.forEach(w => {
      console.log(`  - ${w.id}: ${w.type} (flow_id: ${w.flow_id})`);
    });

    // Find automatic_responses node
    const autoResponseNode = widgets.find(w => w.type === 'automatic_responses');
    if (!autoResponseNode) {
      console.log('\n❌ No automatic_responses node found!');
      process.exit(1);
    }
    console.log('\n✅ Found automatic_responses node:', autoResponseNode.id);

    // Get options for this node
    const options = await Option.find({ widget_id: autoResponseNode.id });
    console.log(`Options: ${options.length} found`);
    options.forEach(o => {
      console.log(`  - ${o.value} (operator: ${o.operator || 'eq'}, next: ${o.next})`);
    });

    // Check for existing session
    const session = await BotSession.findOne({
      customer_phone: phone,
      sender,
      is_active: true
    }).sort({ updated_at: -1 });

    if (session) {
      console.log('\n✅ Existing session found:', {
        current_node_id: session.current_node_id,
        flow_id: session.flow_id,
        is_active: session.is_active
      });
    } else {
      console.log('\n⚠️  No existing session found');
    }

    console.log('\n✅ Debug complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugChat();

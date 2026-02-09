import mongoose from 'mongoose';
import BotFlow from './models/BotFlow.js';
import Widget from './models/Widget.js';
import User from './models/User.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/bots';

async function createMissingBot() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find or create first user
    let user = await User.findOne();
    if (!user) {
      console.log('👤 Creating new user...');
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      user = await User.create({
        name: 'Admin User',
        username: 'admin',
        password: 'admin123',
        email: 'admin@example.com',
        token: token,
        account_type: 'Premium'
      });
      console.log(`✅ Created user: ${user.username}`);
      console.log(`🔑 Token: ${token}`);
    } else {
      console.log(`👤 Found user: ${user.username} (${user._id})`);
    }

    // Get all widgets and find unique flow_ids
    const widgets = await Widget.find();
    const flowIds = [...new Set(widgets.map(w => w.flow_id))].filter(Boolean);
    
    console.log(`\n📊 Found ${widgets.length} widgets with ${flowIds.length} flow_id(s):`);
    for (const flowId of flowIds) {
      const count = widgets.filter(w => w.flow_id === flowId).length;
      console.log(`  - ${flowId}: ${count} widgets`);
    }

    if (flowIds.length === 0) {
      console.log('❌ No widgets found with flow_id!');
      process.exit(1);
    }

    // Create bot with the flow_id from widgets
    const targetFlowId = flowIds[0];
    console.log(`\n🔧 Creating bot with ID: ${targetFlowId}`);
    
    const bot = new BotFlow({
      _id: new mongoose.Types.ObjectId(targetFlowId),
      name: 'חדש',
      user_id: user._id.toString(),
      public_id: Math.random().toString(36).substring(2, 12),
      created_at: new Date()
    });
    
    await bot.save();
    console.log(`✅ Created bot: ${bot.name} (${bot._id})`);

    console.log('\n✨ Done! You can now use the chat API.');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createMissingBot();

import mongoose from 'mongoose';
import BotFlow from './models/BotFlow.js';
import Widget from './models/Widget.js';

const MONGODB_URI = 'mongodb://localhost:27017/botswa';

async function fixFlowIds() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all bots
    const bots = await BotFlow.find();
    console.log(`\n📊 Found ${bots.length} bots:`);
    bots.forEach(bot => {
      console.log(`  - ${bot.name} (ID: ${bot._id})`);
    });

    // Get all widgets grouped by flow_id
    const widgets = await Widget.find();
    const flowIds = [...new Set(widgets.map(w => w.flow_id))].filter(Boolean);
    
    console.log(`\n📊 Found widgets with ${flowIds.length} different flow_ids:`);
    for (const flowId of flowIds) {
      const count = widgets.filter(w => w.flow_id === flowId).length;
      console.log(`  - ${flowId}: ${count} widgets`);
    }

    // Check for mismatches
    console.log('\n🔍 Checking for mismatches...');
    for (const flowId of flowIds) {
      const botExists = bots.some(b => b._id.toString() === flowId);
      if (!botExists) {
        console.log(`\n⚠️ Flow ID ${flowId} doesn't match any bot!`);
        
        // If there's only one bot, offer to fix
        if (bots.length === 1) {
          const correctBotId = bots[0]._id.toString();
          console.log(`\n🔧 Updating widgets from ${flowId} to ${correctBotId}`);
          
          const result = await Widget.updateMany(
            { flow_id: flowId },
            { $set: { flow_id: correctBotId } }
          );
          
          console.log(`✅ Updated ${result.modifiedCount} widgets`);
        }
      } else {
        console.log(`✅ Flow ID ${flowId} matches bot ${bots.find(b => b._id.toString() === flowId).name}`);
      }
    }

    console.log('\n✨ Done!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixFlowIds();

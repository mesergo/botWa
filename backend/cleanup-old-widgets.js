import mongoose from 'mongoose';
import Widget from './models/Widget.js';
import BotSession from './models/BotSession.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/bots';

async function cleanupOldWidgets() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const correctFlowId = '69833f31982d3ef6b8351b1c';
    
    // Delete ALL widgets that don't belong to our bot
    console.log('🗑️ Deleting old widgets...');
    const deleteResult = await Widget.deleteMany({
      $or: [
        { flow_id: null },
        { flow_id: { $ne: correctFlowId } }
      ]
    });
    console.log(`✅ Deleted ${deleteResult.deletedCount} old widgets`);
    
    // Verify what's left
    const remaining = await Widget.countDocuments({ flow_id: correctFlowId });
    console.log(`\n✔️ Remaining widgets for bot: ${remaining}`);
    
    // Clear all sessions
    console.log('\n🗑️ Clearing all sessions...');
    const sessionsResult = await BotSession.deleteMany({});
    console.log(`✅ Deleted ${sessionsResult.deletedCount} sessions`);

    console.log('\n✨ Cleanup complete!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupOldWidgets();

import mongoose from 'mongoose';
import Widget from './models/Widget.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/bots';

async function fixWidgetsFlowId() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const wrongFlowId = '69834137982d3ef6b8351b3d';
    const correctFlowId = '69833f31982d3ef6b8351b1c';

    console.log(`🔧 Updating widgets from ${wrongFlowId} to ${correctFlowId}`);

    const result = await Widget.updateMany(
      { flow_id: wrongFlowId },
      { $set: { flow_id: correctFlowId } }
    );

    console.log(`✅ Updated ${result.modifiedCount} widgets`);

    // Verify
    const count = await Widget.countDocuments({ flow_id: correctFlowId });
    console.log(`\n✔️ Now there are ${count} widgets with flow_id ${correctFlowId}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixWidgetsFlowId();

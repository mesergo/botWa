import mongoose from 'mongoose';
import BotSession from './models/BotSession.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/bots';

async function clearSessions() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const phone = '972548505808';
    console.log(`🗑️ Deleting sessions for phone: ${phone}`);

    const result = await BotSession.deleteMany({ customer_phone: phone });
    console.log(`✅ Deleted ${result.deletedCount} sessions`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearSessions();

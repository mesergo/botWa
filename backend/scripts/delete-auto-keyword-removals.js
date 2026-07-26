/**
 * delete-auto-keyword-removals.js
 * One-time cleanup: deletes all GroupRemovalLog entries where removed_by = 'auto-keyword'.
 * These were incorrectly created when a contact sent an opt-out keyword to the bot.
 *
 * Run with:
 *   node scripts/delete-auto-keyword-removals.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/flowbot';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
 
  const result = await mongoose.connection.collection('GroupRemovalLog').deleteMany({
    removed_by: 'auto-keyword'
  });

  console.log(`Deleted ${result.deletedCount} auto-keyword removal log entries.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

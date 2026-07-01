/**
 * fix-phone-numbers.js
 * One-time script: strips spaces, dashes and dots from display_phone_number
 * in user.connected_numbers[] and in BotFlow.display_phone_number.
 *
 * Run with:
 *   node scripts/fix-phone-numbers.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';

function normalizePhone(phone) {
  if (!phone) return phone;
  return phone.replace(/[\s\-\.]/g, '');
}

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flowbot');
console.log('Connected to MongoDB');

let usersFixed = 0;
let numbersFixed = 0;
let botsFixed = 0;

// Fix User.connected_numbers
const users = await User.find({ 'connected_numbers.0': { $exists: true } });
for (const user of users) {
  let dirty = false;
  for (const n of user.connected_numbers) {
    const fixed = normalizePhone(n.display_phone_number);
    if (fixed !== n.display_phone_number) {
      console.log(`User ${user._id}: "${n.display_phone_number}" → "${fixed}"`);
      n.display_phone_number = fixed;
      dirty = true;
      numbersFixed++;
    }
  }
  if (dirty) {
    user.markModified('connected_numbers');
    await user.save();
    usersFixed++;
  }
}

// Fix BotFlow.display_phone_number
const bots = await BotFlow.find({ display_phone_number: { $regex: /[\s\-\.]/ } });
for (const bot of bots) {
  const fixed = normalizePhone(bot.display_phone_number);
  console.log(`Bot ${bot._id} (${bot.name}): "${bot.display_phone_number}" → "${fixed}"`);
  bot.display_phone_number = fixed;
  await bot.save();
  botsFixed++;
}

console.log(`\nDone. Users updated: ${usersFixed}, numbers fixed: ${numbersFixed}, bots fixed: ${botsFixed}`);
await mongoose.disconnect();
process.exit(0);

/**
 * fix-phone-numbers.js
 * One-time script: normalizes display_phone_number in user.connected_numbers[]
 * and BotFlow.display_phone_number to the same format used by the application.
 * Only changed values are counted; each write is read back for verification.
 *
 * Run from backend with:
 *   npm run fix-phone-numbers
 *   or: node scripts/fix-phone-numbers.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import { normalizePhone } from '../utils/phone.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flowbot');
console.log(`Connected to MongoDB: ${mongoose.connection.host} / ${mongoose.connection.name}`);

try {
  let usersFixed = 0;
  let numbersFixed = 0;
  let botsFixed = 0;

  const users = await User.find({ 'connected_numbers.0': { $exists: true } });
  for (const user of users) {
    const changes = [];
    for (const n of user.connected_numbers) {
      const fixed = normalizePhone(n.display_phone_number);
      if (fixed !== n.display_phone_number) {
        changes.push({ id: String(n._id), before: n.display_phone_number, after: fixed });
        n.display_phone_number = fixed;
      }
    }
    if (!changes.length) continue;

    user.markModified('connected_numbers');
    await user.save();
    const saved = await User.findById(user._id).select('connected_numbers').lean();
    for (const change of changes) {
      const entry = saved?.connected_numbers?.find(n => String(n._id) === change.id);
      if (!entry || entry.display_phone_number !== change.after) {
        throw new Error(`Verification failed for user ${user._id}, connected number ${change.id}`);
      }
      console.log(`Verified User ${user._id}: "${change.before}" → "${change.after}"`);
    }
    usersFixed++;
    numbersFixed += changes.length;
  }

  const bots = await BotFlow.find({ display_phone_number: { $ne: '' } });
  for (const bot of bots) {
    const before = bot.display_phone_number;
    const fixed = normalizePhone(before);
    if (fixed === before) continue;

    bot.display_phone_number = fixed;
    await bot.save();
    const saved = await BotFlow.findById(bot._id).select('display_phone_number').lean();
    if (!saved || saved.display_phone_number !== fixed) {
      throw new Error(`Verification failed for bot ${bot._id}`);
    }
    console.log(`Verified Bot ${bot._id} (${bot.name}): "${before}" → "${fixed}"`);
    botsFixed++;
  }

  console.log(`\nDone. Users updated: ${usersFixed}, numbers fixed: ${numbersFixed}, bots fixed: ${botsFixed}`);
} finally {
  await mongoose.disconnect();
}

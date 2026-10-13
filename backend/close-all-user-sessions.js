/**
 * Close (deactivate) ALL active BotSession records belonging to one user.
 *
 * Usage (run from the backend/ folder on the server):
 *   node close-all-user-sessions.js <email-or-user_id>            # dry run — only shows how many would be closed
 *   node close-all-user-sessions.js <email-or-user_id> --confirm  # actually performs the update
 *
 * <email-or-user_id> can be either the user's login email, or their Mongo _id directly.
 *
 * What "closed" means here (mirrors the existing manual "סיום שיחה" / close-conversation
 * logic in utils/conversationActions.js -> buildConversationClosedSetFragment):
 *   - status        -> 'closed'
 *   - is_agent      -> false
 *   - agent_since   -> null
 *   - ended_at      -> now 
 *   - is_active     -> false   (next incoming customer message starts a brand-new session
 *                                instead of resuming this one — BotSession lookups filter
 *                                on is_active:true)
 *   - reminder_case1/2 next_due_at & claim_until -> null (stop any pending reminders)
 *
 * Only sessions currently is_active:true are touched (already-closed/inactive sessions
 * are left alone).
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import BotSession from './models/BotSession.js';
import { buildConversationClosedSetFragment } from './utils/conversationActions.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowbot';

async function main() {
  const identifier = process.argv[2];
  const confirm = process.argv.includes('--confirm');

  if (!identifier) {
    console.error('❌ Usage: node close-all-user-sessions.js <email-or-user_id> [--confirm]');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB:', MONGODB_URI.replace(/\/\/[^@]+@/, '//***@'));

  try {
    // Resolve the user — accept either a raw Mongo _id or a login email
    let user = null;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      user = await User.findById(identifier);
    }
    if (!user) {
      user = await User.findOne({ email: identifier });
    }

    if (!user) {
      console.error(`❌ No user found matching "${identifier}"`);
      process.exit(1);
    }

    const userId = String(user._id);
    console.log(`👤 User: ${user.email} (${userId})`);

    const filter = { user_id: userId, is_active: true };
    const matchCount = await BotSession.countDocuments(filter);
    console.log(`📊 Active sessions found: ${matchCount}`);

    if (matchCount === 0) {
      console.log('ℹ️ Nothing to do.');
      return;
    }

    if (!confirm) {
      console.log('\n⚠️ Dry run only — no changes made. Re-run with --confirm to actually close these sessions.');
      return;
    }

    const update = { $set: buildConversationClosedSetFragment(new Date()) };
    const result = await BotSession.updateMany(filter, update);
    console.log(`✅ Closed ${result.modifiedCount} session(s) for user ${user.email} (${userId})`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

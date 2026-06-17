/**
 * migrate-dedup-contacts.js
 * ─────────────────────────
 * Merges duplicate Contact records that represent the same person
 * (same user_id, same phone after normalisation to 972XXXXXXXXX).
 *
 * Strategy for each group of duplicates:
 *   1. Pick the "winner": prefer the record whose phone already starts
 *      with 972; if none does, take the newest one.
 *   2. Merge all data from the losers into the winner (fill empty fields,
 *      union assigned_to arrays, union group memberships).
 *   3. Update every BotSession that references a loser phone → winner phone.
 *   4. Update every Group that holds a loser contact_id or phone → winner.
 *   5. Delete the loser records.
 *
 * Run from the project root:
 *   node backend/scripts/migrate-dedup-contacts.js
 *
 * Add --dry-run to preview changes without writing anything.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env from backend/ regardless of where the script is invoked from
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import BotSession from '../models/BotSession.js';
import Group from '../models/Group.js';
import { normalizePhone } from '../utils/phone.js';

const DRY_RUN = process.argv.includes('--dry-run');

// ─── helpers ────────────────────────────────────────────────────────────────

function pick(a, b) {
  // prefer truthy, non-empty value
  if (a && String(a).trim()) return a;
  return b;
}

function unionObjectIds(arr1 = [], arr2 = []) {
  const set = new Set([...arr1, ...arr2].map(String));
  return Array.from(set).map(id => new mongoose.Types.ObjectId(id));
}

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flowbot';
  console.log(`\n🔌 Connecting to MongoDB…`);
  await mongoose.connect(uri, { bufferCommands: false });
  console.log(`✅ Connected (db: ${mongoose.connection.name})\n`);

  if (DRY_RUN) {
    console.log('🔎  DRY RUN — no changes will be written\n');
  }

  // Load all contacts (we normalise in memory; collection may be large but
  // contacts are lightweight documents).
  console.log('📥 Loading all contacts…');
  const allContacts = await Contact.find({}).lean();
  console.log(`   ${allContacts.length} contacts loaded.\n`);

  // Group by (user_id, normalizedPhone)
  const groups = new Map(); // key → [contact, …]
  for (const c of allContacts) {
    const normPhone = normalizePhone(c.phone);
    const key = `${c.user_id}__${normPhone}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...c, _normPhone: normPhone });
  }

  const dupGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`🔍 Found ${dupGroups.length} duplicate group(s).\n`);

  if (dupGroups.length === 0) {
    console.log('🎉 No duplicates found — nothing to do.');
    await mongoose.disconnect();
    return;
  }

  let mergedCount = 0;
  let deletedCount = 0;

  for (const [key, dupes] of dupGroups) {
    const normPhone = dupes[0]._normPhone;
    const userId = dupes[0].user_id;

    // Sort: prefer record that already has 972 prefix, then by newest createdAt
    dupes.sort((a, b) => {
      const aIs972 = String(a.phone).startsWith('972') ? 0 : 1;
      const bIs972 = String(b.phone).startsWith('972') ? 0 : 1;
      if (aIs972 !== bIs972) return aIs972 - bIs972;
      return new Date(b.createdAt) - new Date(a.createdAt); // newest first
    });

    const winner = dupes[0];
    const losers = dupes.slice(1);

    console.log(`\n─────────────────────────────────────`);
    console.log(`👤 user_id   : ${userId}`);
    console.log(`📞 norm phone: ${normPhone}`);
    console.log(`✅ WINNER    : ${winner.phone}  (_id: ${winner._id})`);
    losers.forEach(l => console.log(`❌ LOSER     : ${l.phone}  (_id: ${l._id})`));

    // Build merged document
    const mergedFullName      = losers.reduce((acc, l) => pick(acc, l.full_name),      winner.full_name);
    const mergedWhatsappName  = losers.reduce((acc, l) => pick(acc, l.whatsapp_name),  winner.whatsapp_name);
    const mergedEmail         = losers.reduce((acc, l) => pick(acc, l.email),           winner.email);
    const mergedCustomFields  = Object.assign(
      {},
      ...losers.map(l => l.custom_field_values || {}),
      winner.custom_field_values || {}   // winner values take priority
    );
    const mergedAssignedTo    = unionObjectIds(
      winner.assigned_to,
      ...losers.map(l => l.assigned_to || [])
    );

    console.log(`   full_name : "${mergedFullName}"`);
    console.log(`   email     : "${mergedEmail}"`);

    if (!DRY_RUN) {
      // 1. Update winner record
      await Contact.updateOne(
        { _id: winner._id },
        {
          $set: {
            phone: normPhone,
            full_name:         mergedFullName,
            whatsapp_name:     mergedWhatsappName,
            email:             mergedEmail,
            custom_field_values: mergedCustomFields,
            assigned_to:       mergedAssignedTo,
          },
        }
      );

      // 2. Update BotSessions referencing any loser phone → winner phone
      const loserPhones = losers.map(l => l.phone);
      await BotSession.updateMany(
        { $or: [{ sender: { $in: loserPhones } }, { customer_phone: { $in: loserPhones } }] },
        { $set: { sender: normPhone, customer_phone: normPhone } }
      );

      // 3. Update Group documents (split $pull and $addToSet — cannot combine on same field)
      for (const loser of losers) {
        // contact_ids: first add winner, then remove loser
        await Group.updateMany(
          { contact_ids: loser._id },
          { $addToSet: { contact_ids: winner._id } }
        );
        await Group.updateMany(
          { contact_ids: loser._id },
          { $pull: { contact_ids: loser._id } }
        );
        // phones: first add winner phone, then remove loser phone
        await Group.updateMany(
          { phones: loser.phone },
          { $addToSet: { phones: normPhone } }
        );
        await Group.updateMany(
          { phones: loser.phone },
          { $pull: { phones: loser.phone } }
        );
      }

      // 4. Delete losers
      const loserIds = losers.map(l => l._id);
      await Contact.deleteMany({ _id: { $in: loserIds } });
    }

    mergedCount++;
    deletedCount += losers.length;
  }

  console.log(`\n${'═'.repeat(40)}`);
  if (DRY_RUN) {
    console.log(`🔎 DRY RUN complete — would have merged ${mergedCount} group(s), deleted ${deletedCount} duplicate(s).`);
  } else {
    console.log(`✅ Migration complete!`);
    console.log(`   Merged  : ${mergedCount} group(s)`);
    console.log(`   Deleted : ${deletedCount} duplicate contact(s)`);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected.\n');
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

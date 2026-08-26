/**
 * ONE-TIME SCRIPT
 *
 * Copies SMS messages that exist in the external "ilbot" SMS MongoDB
 * (SMS_MONGODB_URI — the source used by the "SMS נכנס" tab / sms-in module)
 * but are missing from our own MongoDB (SmsExternalLog model, collection
 * "sms" in the main app DB — the source used by the "SMS פנימי" tab).
 * 
 * Dedup key: dest + phone + message + date (exact string match).
 * Confirmed on production data that `date` is stored as "DD/MM/YY HH:mm:ss"
 * (includes seconds), so this key is precise enough to avoid treating two
 * distinct messages as duplicates.
 *
 * Safe to re-run — messages that already exist (by the key above, either
 * from a previous run of this script or already present) are skipped.
 *  
 * Usage (from backend/):
 *   node migrate-sms-external-to-internal.js
 *   node migrate-sms-external-to-internal.js --dry-run   (report only, no writes)
 */

// Must be the first import: loads .env as a side effect before any other
// module (e.g. sms-in/smsDb.js) reads process.env at its own module-load time.
import 'dotenv/config';
import mongoose from 'mongoose';
import SmsExternalLog from './models/SmsExternalLog.js';
import { connectSmsDb, getSmsCollection, isSmsConfigured } from './sms-in/smsDb.js';

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(doc) {
  return {
    dest: String(doc.dest ?? doc.Destination ?? '').trim(),
    phone: String(doc.phone ?? doc.Sender ?? '').trim(),
    message: String(doc.message ?? doc.MessageText ?? doc.Message ?? '').trim(),
    date: String(doc.date ?? doc.Date ?? '').trim(),
  };
}

function keyOf(n) {
  return `${n.dest}|${n.phone}|${n.message}|${n.date}`;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowbot');
  console.log('✅ Connected to internal MongoDB');

  if (!isSmsConfigured()) throw new Error('SMS_MONGODB_URI is not set');
  await connectSmsDb();
  const externalCollection = await getSmsCollection();
  if (!externalCollection) throw new Error('Could not connect to external (ilbot) SMS DB');
  console.log('✅ Connected to external (ilbot) MongoDB');

  if (DRY_RUN) console.log('🧪 Dry run — no documents will be inserted\n');

  // Load all existing internal docs into a Set of content-keys for fast lookup
  const internalDocs = await SmsExternalLog.find({}, { dest: 1, phone: 1, message: 1, date: 1 }).lean();
  const existingKeys = new Set(internalDocs.map((d) => keyOf(normalize(d))));
  console.log(`ℹ️ Internal DB already has ${existingKeys.size} messages`);
  // Snapshot of keys that were ALREADY in the internal DB before this scan starts,
  // so we can tell apart "already in internal DB" from "duplicate within the
  // external export itself" (both end up added to existingKeys as we scan).
  const originalInternalKeys = new Set(existingKeys);

  const cursor = externalCollection.find({});
  let total = 0;
  let invalid = 0;
  let alreadyInInternal = 0;
  let duplicateWithinExternal = 0;
  const toInsert = [];
  const duplicateWithinExternalSamples = [];
  const SAMPLE_LIMIT = 5;

  while (await cursor.hasNext()) {
    const raw = await cursor.next();
    total++;
    const norm = normalize(raw);
    if (!norm.dest || !norm.phone || !norm.message) {
      invalid++;
      continue;
    }

    const key = keyOf(norm);
    if (existingKeys.has(key)) {
      if (originalInternalKeys.has(key)) {
        alreadyInInternal++;
      } else {
        duplicateWithinExternal++;
        if (duplicateWithinExternalSamples.length < SAMPLE_LIMIT) {
          duplicateWithinExternalSamples.push({ _id: raw._id, ...norm });
        }
      }
      continue;
    }

    existingKeys.add(key); // avoid duplicate inserts within this same run
    toInsert.push({ appName: 'ilbot-import', ...norm });
  }

  let inserted = 0;
  if (toInsert.length > 0 && !DRY_RUN) {
    const result = await SmsExternalLog.insertMany(toInsert, { ordered: false });
    inserted = result.length;
  }

  console.log(`\n📊 External total scanned: ${total}`);
  console.log(`📊 Invalid (missing dest/phone/message): ${invalid}`);
  console.log(`📊 ${DRY_RUN ? 'Would insert' : 'Newly inserted'} into internal DB: ${toInsert.length}${DRY_RUN ? '' : ` (confirmed: ${inserted})`}`);
  console.log(`📊 Skipped — matched an existing internal message: ${alreadyInInternal}`);
  console.log(`📊 Skipped — duplicate within the external export itself: ${duplicateWithinExternal}`);

  if (duplicateWithinExternalSamples.length > 0) {
    console.log(`\n🔎 Sample of "duplicate within external" docs (up to ${SAMPLE_LIMIT}):`);
    duplicateWithinExternalSamples.forEach((doc, i) => {
      console.log(`  ${i + 1}.`, JSON.stringify(doc));
    });
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
}); 
 
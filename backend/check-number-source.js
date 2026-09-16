// One-off diagnostic: checks a specific dest number in the two sources that matter —
// the external ilbot DB (the real numbers table) and SmsDestSetting (the שיוך קווים
// assignment table) — to confirm it exists in one and not the other. Run from backend/
// on the server:
//   node check-number-source.js 972559939114
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import mongodbPkg from 'mongodb';
const { MongoClient } = mongodbPkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const number = process.argv[2];
if (!number) {
  console.error('Usage: node check-number-source.js <number>');
  process.exit(1);
}

async function checkIlbot() {
  const uri = process.env.SMS_MONGODB_URI;
  if (!uri) return console.log('[ilbot] SMS_MONGODB_URI not set');
  const collName = process.env.SMS_MONGODB_COLLECTION || 'sms';
  const client = new MongoClient(uri, { connectTimeoutMS: 6000, serverSelectionTimeoutMS: 6000 });
  try {
    await client.connect();
    const dbName = new URL(uri).pathname.replace(/^\//, '');
    const db = client.db(dbName);
    const coll = db.collection(collName);
    const count = await coll.countDocuments({ $or: [{ dest: number }, { Destination: number }] });
    console.log(`[ilbot:${dbName}.${collName}] documents with this dest: ${count}`);
    if (count > 0) {
      const sample = await coll.findOne({ $or: [{ dest: number }, { Destination: number }] });
      console.log('[ilbot] sample doc:', JSON.stringify(sample));
    }
    const totalDistinct = await coll.distinct('dest');
    console.log(`[ilbot] total distinct 'dest' values in collection: ${totalDistinct.length}`);
  } catch (e) {
    console.log('[ilbot] ERROR:', e.message);
  } finally {
    await client.close().catch(() => {});
  }
}

async function checkMainDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return console.log('[main] MONGODB_URI not set');
  await mongoose.connect(uri);

  const SmsDestSetting = mongoose.model('SmsDestSetting', new mongoose.Schema({}, { strict: false, collection: 'sms_dest_settings' }));
  const settingDoc = await SmsDestSetting.findOne({ dest: number }).lean();
  console.log('[main.sms_dest_settings] row for this dest:', settingDoc ? JSON.stringify(settingDoc) : 'NONE (no row at all)');
  const settingsTotal = await SmsDestSetting.countDocuments({});
  console.log(`[main.sms_dest_settings] total rows in table: ${settingsTotal}`);

  await mongoose.disconnect();
}

(async () => {
  console.log(`Checking number: ${number}\n`);
  await checkIlbot();
  console.log('');
  await checkMainDb();
})();

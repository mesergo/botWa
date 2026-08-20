// Manual end-to-end test for the phone-number login (OTP via WhatsApp) endpoints.
//
// Usage:
//   node test-phone-auth.js                 -> lists users that have a phone on file
//   node test-phone-auth.js <phone>         -> calls /phone/start, then prompts for the
//                                              code that arrives on WhatsApp, then calls
//                                              /phone/verify and prints the result
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import readline from 'readline';
import fetch from 'node-fetch';
import User from './models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/flowbot';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

const ask = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
});

async function listUsersWithPhone() {
  const users = await User.find({ phone: { $exists: true, $ne: '' } }).select('name email phone');
  if (users.length === 0) {
    console.log('❌ No users with a phone number found in the DB.');
    return;
  }
  console.log(`Found ${users.length} user(s) with a phone number:\n`);
  users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.name} | ${u.email} | phone: ${u.phone}`);
  });
  console.log('\nRun again with: node test-phone-auth.js <phone>');
}

async function runFlow(phone) {
  console.log(`\n➡️  POST ${BASE_URL}/api/auth/phone/start  { phone: "${phone}" }`);
  const startRes = await fetch(`${BASE_URL}/api/auth/phone/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  const startBody = await startRes.json().catch(() => ({}));
  console.log(`⬅️  HTTP ${startRes.status}:`, startBody);
  if (!startRes.ok) return;

  console.log('\n📲 Check WhatsApp on that phone for the 6-digit code (and check server logs for [WA-PUSH] lines).');
  const code = await ask('Enter the code you received: ');

  console.log(`\n➡️  POST ${BASE_URL}/api/auth/phone/verify  { phone: "${phone}", code: "${code}" }`);
  const verifyRes = await fetch(`${BASE_URL}/api/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code })
  });
  const verifyBody = await verifyRes.json().catch(() => ({}));
  console.log(`⬅️  HTTP ${verifyRes.status}:`, verifyBody);

  if (verifyBody.requiresAccountSelection) {
    console.log('\n⚠️  Multiple accounts share this phone. Retry with one of these accountIds:');
    verifyBody.accounts.forEach(a => console.log(`   - ${a.id} (${a.name})`));
    const accountId = await ask('Enter accountId to retry with: ');
    const retryRes = await fetch(`${BASE_URL}/api/auth/phone/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, accountId })
    });
    const retryBody = await retryRes.json().catch(() => ({}));
    console.log(`⬅️  HTTP ${retryRes.status}:`, retryBody);
  }
}

const phoneArg = process.argv[2];

try {
  await mongoose.connect(MONGODB_URI);
  if (!phoneArg) {
    await listUsersWithPhone();
  } else {
    await runFlow(phoneArg);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await mongoose.disconnect();
  process.exit(0);
}

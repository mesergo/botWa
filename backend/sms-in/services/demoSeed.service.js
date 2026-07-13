import { DEMO_MESSAGES } from '../data/demoMessages.js';
import { getSmsCollection } from '../smsDb.js';

export function isLocalSmsUri() {
  const uri = process.env.SMS_MONGODB_URI || '';
  return /localhost|127\.0\.0\.1/i.test(uri);
}

export function isDemoSeedEnabled() {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.SMS_DEMO_SEED === 'false') return false;
  return true;
}

export async function seedSmsDemoIfEmpty() {
  if (!isDemoSeedEnabled()) return false;

  const collection = await getSmsCollection();
  if (!collection) return false;

  const count = await collection.countDocuments();
  if (count > 0) return false;

  const now = new Date();
  await collection.insertMany(
    DEMO_MESSAGES.map((m) => ({
      ...m,
      isDemo: true,
      createdAt: now,
    }))
  );

  console.log(`✅ Seeded ${DEMO_MESSAGES.length} demo SMS messages into ${process.env.SMS_MONGODB_COLLECTION || 'sms'}`);
  return true;
}

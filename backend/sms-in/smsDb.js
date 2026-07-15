import { MongoClient } from 'mongodb';

const SMS_MONGODB_URI = process.env.SMS_MONGODB_URI || '';
const SMS_COLLECTION = process.env.SMS_MONGODB_COLLECTION || 'sms';

let client = null;
let connected = false;

function getDbNameFromUri() {
  if (!SMS_MONGODB_URI) return '';
  try {
    const pathname = new URL(SMS_MONGODB_URI).pathname.replace(/^\//, '');
    return pathname || '';
  } catch {
    return '';
  }
}

export function isSmsConfigured() {
  return Boolean(SMS_MONGODB_URI);
}

export function isSmsConnected() {
  return connected;
}

export function getSmsCollectionName() {
  return SMS_COLLECTION;
}

export function getSmsDbName() {
  return getDbNameFromUri();
}

export async function connectSmsDb() {
  if (!SMS_MONGODB_URI) return null;
  if (connected && client) return client.db(getDbNameFromUri());

  const mongoClient = new MongoClient(SMS_MONGODB_URI, {
    connectTimeoutMS: 4000,
    serverSelectionTimeoutMS: 4000,
  });

  try {
    await mongoClient.connect();
    client = mongoClient;
    connected = true;
    console.log(`✅ SMS MongoDB connected (${getDbNameFromUri()}/${SMS_COLLECTION})`);
    return client.db(getDbNameFromUri());
  } catch (err) {
    connected = false;
    if (client) {
      await client.close().catch(() => {});
      client = null;
    }
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      console.warn('⚠️ SMS MongoDB not connected:', err.message);
    } else {
      console.log('ℹ️ SMS DB unavailable locally — will connect automatically in production');
    }
    return null;
  }
}

async function getDb() {
  if (!SMS_MONGODB_URI) return null;
  if (!connected || !client) {
    await connectSmsDb();
  }
  if (!connected || !client) return null;
  return client.db(getDbNameFromUri());
}

export async function getSmsCollection() {
  const db = await getDb();
  if (!db) return null;
  return db.collection(SMS_COLLECTION);
}

export async function pingSmsDb() {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.command({ ping: 1 });
    return true;
  } catch {
    connected = false;
    return false;
  }
}

export async function listSmsCollections() {
  const db = await getDb();
  if (!db) return [];
  const collections = await db.listCollections().toArray();
  return collections.map((col) => col.name);
}

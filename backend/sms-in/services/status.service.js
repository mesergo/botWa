import {
  isSmsConfigured,
  isSmsConnected,
  pingSmsDb,
  listSmsCollections,
  getSmsDbName,
  getSmsCollectionName,
  getSmsCollection,
} from '../smsDb.js';
import { isLocalSmsUri, isDemoSeedEnabled } from './demoSeed.service.js';

const PROD_DISCONNECTED =
  'Could not connect to SMS MongoDB — check SMS_MONGODB_URI';
const DEV_DISCONNECTED =
  'אין חיבור ל-MongoDB מקומי — מוצגים נתוני דמו מהשרת';
const DEV_CONNECTED_LOCAL =
  'מחובר ל-MongoDB מקומי עם נתוני דמו';
const PROD_CONNECTED =
  'מחובר לטבלת SMS אמיתית';

async function hasDemoDocuments() {
  try {
    const collection = await getSmsCollection();
    if (!collection) return false;
    const demoCount = await collection.countDocuments({ isDemo: true });
    return demoCount > 0;
  } catch {
    return false;
  }
}

function buildConnectedStatus({ dbName, collection, names }) {
  const isProd = process.env.NODE_ENV === 'production';
  const localDev = !isProd;
  const demoMode = localDev && (isLocalSmsUri() || isDemoSeedEnabled());

  return {
    connected: true,
    configured: true,
    localDev,
    demoMode,
    dbName,
    collection,
    exists: names.includes(collection),
    collectionsDetected: names,
    message: demoMode ? DEV_CONNECTED_LOCAL : PROD_CONNECTED,
  };
}

export async function getStatus() {
  const collection = getSmsCollectionName();
  const dbName = getSmsDbName();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isSmsConfigured()) {
    return {
      connected: false,
      configured: false,
      localDev: !isProd,
      demoMode: !isProd,
      message: isProd
        ? 'Missing SMS_MONGODB_URI in backend/.env'
        : DEV_DISCONNECTED,
      dbName,
      collection,
    };
  }

  if (isSmsConnected()) {
    try {
      await pingSmsDb();
      const names = await listSmsCollections();
      const status = buildConnectedStatus({ dbName, collection, names });
      if (status.demoMode) {
        status.seeded = await hasDemoDocuments();
      }
      return status;
    } catch {
      // fall through to disconnected state
    }
  }

  const reachable = await pingSmsDb();
  if (reachable) {
    const names = await listSmsCollections();
    const status = buildConnectedStatus({ dbName, collection, names });
    if (status.demoMode) {
      status.seeded = await hasDemoDocuments();
    }
    return status;
  }

  return {
    connected: false,
    configured: true,
    localDev: !isProd,
    demoMode: !isProd,
    message: isProd ? PROD_DISCONNECTED : DEV_DISCONNECTED,
    dbName,
    collection,
  };
}

import {
  isSmsConfigured,
  isSmsConnected,
  pingSmsDb,
  listSmsCollections,
  getSmsDbName,
  getSmsCollectionName,
} from '../smsDb.js';

const DISCONNECTED_MESSAGE =
  'Could not connect to SMS MongoDB — check SMS_MONGODB_URI';
const CONNECTED_MESSAGE = 'מחובר לטבלת SMS אמיתית';

function buildConnectedStatus({ dbName, collection, names }) {
  return {
    connected: true,
    configured: true,
    dbName,
    collection,
    exists: names.includes(collection),
    collectionsDetected: names,
    message: CONNECTED_MESSAGE,
  };
}

export async function getStatus() {
  const collection = getSmsCollectionName();
  const dbName = getSmsDbName();

  if (!isSmsConfigured()) {
    return {
      connected: false,
      configured: false,
      message: 'Missing SMS_MONGODB_URI in backend/.env',
      dbName,
      collection,
    };
  }

  if (isSmsConnected()) {
    try {
      await pingSmsDb();
      const names = await listSmsCollections();
      return buildConnectedStatus({ dbName, collection, names });
    } catch {
      // fall through to disconnected state
    }
  }

  const reachable = await pingSmsDb();
  if (reachable) {
    const names = await listSmsCollections();
    return buildConnectedStatus({ dbName, collection, names });
  }

  return {
    connected: false,
    configured: true,
    message: DISCONNECTED_MESSAGE,
    dbName,
    collection,
  };
}

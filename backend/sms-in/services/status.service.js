import mongoose from 'mongoose';
import SmsExternalLog from '../../models/SmsExternalLog.js';

// The SMS inbox now reads from our own internal MongoDB (collection `sms`),
// so the status reflects the internal connection, not the external ilbot DB.
// (The previous external-DB status check was removed along with the startup
// connectSmsDb() call; smsDb.js is kept for the migration script / old code.)
const DISCONNECTED_MESSAGE = 'Internal MongoDB is not connected';
const CONNECTED_MESSAGE = 'מחובר לטבלת SMS פנימית';

export async function getStatus() {
  const dbName = 'internal';
  const collection = SmsExternalLog.collection?.collectionName || 'sms';
  const connected = mongoose.connection.readyState === 1;

  if (!connected) {
    return {
      connected: false,
      configured: true,
      message: DISCONNECTED_MESSAGE,
      dbName,
      collection,
    };
  }

  return {
    connected: true,
    configured: true,
    dbName,
    collection,
    message: CONNECTED_MESSAGE,
  };
}

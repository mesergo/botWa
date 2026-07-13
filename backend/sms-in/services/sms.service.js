import * as smsRepository from '../repositories/sms.repository.js';
import { formatSmsDocument, formatInsertedId } from '../utils/smsFormatter.js';
import { isSmsConfigured, isSmsConnected, connectSmsDb } from '../smsDb.js';

async function ensureSmsReady() {
  if (!isSmsConfigured()) return false;
  if (!isSmsConnected()) await connectSmsDb();
  return isSmsConnected();
}

export async function getRecentMessages(limit = 500) {
  if (!(await ensureSmsReady())) {
    throw new Error('Database not configured');
  }

  const docs = await smsRepository.findRecent(limit);
  return docs.map(formatSmsDocument);
}

export async function createMessage({ dest, phone, date, message }) {
  const doc = {
    dest,
    phone,
    date: date || new Date().toLocaleString('he-IL'),
    message,
    createdAt: new Date(),
  };

  if (!(await ensureSmsReady())) {
    throw new Error('Database not configured');
  }

  const insertedId = await smsRepository.insertOne(doc);
  if (!insertedId) {
    throw new Error('Database not configured');
  }

  return {
    id_: formatInsertedId(insertedId),
    ...doc,
  };
}

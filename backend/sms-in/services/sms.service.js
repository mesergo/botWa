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

// True total document count in the collection (optionally scoped to allowedDests),
// independent of any "recent N" load limit.
export async function countAllMessages(allowedDests) {
  if (!(await ensureSmsReady())) {
    throw new Error('Database not configured');
  }

  return smsRepository.countAll(allowedDests);
}

export async function searchMessages({ search, allowedDests, destQuery, page = 1, limit = 50 }) {
  if (!(await ensureSmsReady())) {
    throw new Error('Database not configured');
  }

  const { docs, total } = await smsRepository.searchMessages({
    search,
    allowedDests,
    destQuery,
    skip: (page - 1) * limit,
    limit,
  });

  return {
    messages: docs.map(formatSmsDocument),
    total,
  };
}

// Authoritative dest numbers that actually have messages (not capped by any
// loaded page). Powers the dest-filter dropdown suggestions.
export async function getDistinctDests(allowedDests) {
  if (!(await ensureSmsReady())) {
    throw new Error('Database not configured');
  }

  return smsRepository.getDistinctDests(allowedDests);
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

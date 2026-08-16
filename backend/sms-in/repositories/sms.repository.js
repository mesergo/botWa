import { ObjectId } from 'mongodb';
import { getSmsCollection, getSmsCollectionName, getSmsDbName } from '../smsDb.js';

export { getSmsCollectionName, getSmsDbName };

export async function findRecent(limit = 500) {
  const collection = await getSmsCollection();
  if (!collection) return [];

  return collection
    .find({})
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();
}

// True count of matching documents in the whole collection (not capped by any
// "recent N" load limit). Used so the UI can show the real total even when no
// search/dest filter is active.
export async function countAll(allowedDests) {
  const collection = await getSmsCollection();
  if (!collection) return 0;

  if (Array.isArray(allowedDests)) {
    if (allowedDests.length === 0) return 0;
    return collection.countDocuments({
      $or: [
        { dest: { $in: allowedDests } },
        { Destination: { $in: allowedDests } },
      ],
    });
  }

  return collection.countDocuments({});
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchFilter(search, allowedDests, destQuery) {
  const filters = [];

  if (Array.isArray(allowedDests)) {
    if (allowedDests.length === 0) return { _id: { $exists: false } };
    filters.push({
      $or: [
        { dest: { $in: allowedDests } },
        { Destination: { $in: allowedDests } },
      ],
    });
  }

  const query = (search || '').trim();
  if (query) {
    const regex = new RegExp(escapeRegex(query), 'i');
    const textMatches = [
      { phone: regex },
      { Sender: regex },
      { message: regex },
      { MessageText: regex },
      { Message: regex },
      { dest: regex },
      { Destination: regex },
    ];
    const objectIdMatch = query.match(/[a-f\d]{24}/i);
    if (objectIdMatch && ObjectId.isValid(objectIdMatch[0])) {
      textMatches.push({ _id: new ObjectId(objectIdMatch[0]) });
    }
    filters.push({ $or: textMatches });
  }

  const dest = (destQuery || '').trim();
  if (dest) {
    const destRegex = new RegExp(escapeRegex(dest), 'i');
    filters.push({
      $or: [
        { dest: destRegex },
        { Destination: destRegex },
      ],
    });
  }

  if (filters.length === 0) return {};
  return filters.length === 1 ? filters[0] : { $and: filters };
}

export async function searchMessages({ search, allowedDests, destQuery, skip = 0, limit = 50 }) {
  const collection = await getSmsCollection();
  if (!collection) return { docs: [], total: 0 };

  const filter = buildSearchFilter(search, allowedDests, destQuery);
  const [docs, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return { docs, total };
}

// Authoritative list of dest numbers that actually have at least one message in
// the collection (never limited to a loaded page). Used to power the dest-filter
// suggestions so users aren't offered numbers that will return zero results.
export async function getDistinctDests(allowedDests) {
  const collection = await getSmsCollection();
  if (!collection) return [];

  const baseFilter = Array.isArray(allowedDests)
    ? (allowedDests.length === 0
      ? { _id: { $exists: false } }
      : { $or: [{ dest: { $in: allowedDests } }, { Destination: { $in: allowedDests } }] })
    : {};

  const [destValues, destinationValues] = await Promise.all([
    collection.distinct('dest', baseFilter),
    collection.distinct('Destination', baseFilter),
  ]);

  const unique = new Set();
  [...destValues, ...destinationValues].forEach((value) => {
    const trimmed = String(value || '').trim();
    if (trimmed) unique.add(trimmed);
  });

  return Array.from(unique).sort();
}

export async function insertOne(smsData) {
  const collection = await getSmsCollection();
  if (!collection) return null;

  const result = await collection.insertOne(smsData);
  return result.insertedId;
}

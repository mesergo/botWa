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

export async function insertOne(smsData) {
  const collection = await getSmsCollection();
  if (!collection) return null;

  const result = await collection.insertOne(smsData);
  return result.insertedId;
}

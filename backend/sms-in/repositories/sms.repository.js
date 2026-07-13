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

export async function insertOne(smsData) {
  const collection = await getSmsCollection();
  if (!collection) return null;

  const result = await collection.insertOne(smsData);
  return result.insertedId;
}

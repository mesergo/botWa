// Computes the "active contacts" count for a user's account: the number of unique
// contacts (by sender/customer_phone) who exchanged messages with the account's bots
// within a rolling window (default 60 days, configurable globally — see
// utils/limits.js getActiveContactsWindowDays). See plan: activeContactsQuota.
import mongoose from 'mongoose';

const SIMULATED_VALUES = ['Simulated', 'simulated'];

/**
 * @param {string} userId
 * @param {number} windowDays
 * @returns {Promise<number>}
 */
export const computeActiveContactsCount = async (userId, windowDays) => {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const collection = mongoose.connection.collection('BotSession');
  const userIdStr = String(userId);

  const pipeline = [
    {
      $match: {
        $or: [{ user_id: userIdStr }, { user_id: userId }],
        updatedAt: { $gte: cutoff },
        simulator_id: { $in: [null, ''] },
        sender: { $nin: SIMULATED_VALUES },
        customer_phone: { $nin: SIMULATED_VALUES }
      }
    },
    {
      $addFields: {
        contactKey: { $ifNull: ['$sender', { $ifNull: ['$customer_phone', 'לא ידוע'] }] },
        _lastHistoryEntry: { $arrayElemAt: ['$process_history', -1] }
      }
    },
    {
      $addFields: {
        lastMsgDate: {
          $convert: {
            input: { $ifNull: ['$_lastHistoryEntry.created', '$updatedAt'] },
            to: 'date',
            onError: '$updatedAt',
            onNull: '$updatedAt'
          }
        }
      }
    },
    {
      $match: {
        contactKey: { $ne: 'לא ידוע' },
        lastMsgDate: { $gte: cutoff }
      }
    },
    { $group: { _id: '$contactKey' } },
    { $count: 'count' }
  ];

  const result = await collection.aggregate(pipeline).toArray();
  return result[0]?.count || 0;
};

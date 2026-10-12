import crypto from 'crypto';
import BotSession from '../models/BotSession.js';

// Stable id attached to every bot entry in BotSession.process_history (and
// copied onto the matching outgoing message object), so a wamid returned by
// pushMessagesToWhatsApp can be stored on exactly the history entry it belongs
// to — independent of how many other entries/messages exist around it.
export const newHistoryId = () => crypto.randomBytes(8).toString('hex');

// Persists wamids onto process_history entries by `hid` with a targeted
// update (no document save, so it cannot overwrite a delivery status the
// webhook wrote in the meantime). Uses the native collection because
// process_history is a Mixed array and Mongoose casting of arrayFilters on
// Mixed paths is unreliable.
//
// msgs[i] and wamidPerMsg[i] must be aligned (as returned by
// pushMessagesToWhatsApp). Several messages may share one wamid (text + options
// are merged into a single WhatsApp message), which is why hids are grouped.
export const saveWamidsByHid = async (sessionId, msgs, wamidPerMsg) => {
  if (!sessionId || !Array.isArray(msgs) || !Array.isArray(wamidPerMsg)) return 0;

  const hidsByWamid = new Map();
  msgs.forEach((m, i) => {
    const wamid = wamidPerMsg[i];
    if (!wamid || !m?.hid) return;
    if (!hidsByWamid.has(wamid)) hidsByWamid.set(wamid, []);
    hidsByWamid.get(wamid).push(m.hid);
  });
  if (!hidsByWamid.size) return 0;

  const set = {};
  const arrayFilters = [];
  let n = 0;
  for (const [wamid, hids] of hidsByWamid) {
    const id = `w${n++}`;
    set[`process_history.$[${id}].wamid`] = wamid;
    arrayFilters.push({ [`${id}.hid`]: { $in: hids } });
  }

  const res = await BotSession.collection.updateOne(
    { _id: sessionId },
    { $set: set },
    { arrayFilters }
  );
  return res.modifiedCount || 0;
};

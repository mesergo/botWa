import 'dotenv/config';
import mongoose from 'mongoose';

const phone = process.argv[2];
if (!phone) {
  console.error('usage: node inspect-session.mjs <phone>');
  process.exit(1);
} 

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const digits = phone.replace(/\D/g, '');
const tail = new RegExp(digits.slice(-9));
const sessions = await db.collection('BotSession').find(
  { $or: [{ sender: tail }, { customer_phone: tail }] },
  { projection: { sender: 1, customer_phone: 1, user_id: 1, flow_id: 1, widget_id: 1, status: 1, is_agent: 1, created_at: 1, createdAt: 1 } }
).sort({ _id: -1 }).limit(10).toArray();

if (sessions.length === 0) console.log('No sessions found for', phone);

for (const s of sessions) {
  console.log('\n=== session', String(s._id));
  console.log(JSON.stringify(s));

  let w = null;
  if (s.widget_id) {
    w = await db.collection('widgets').findOne({ id: s.widget_id });
    console.log('widget:', w ? JSON.stringify({ id: w.id, flow_id: w.flow_id, user_id: w.user_id }) : 'NOT FOUND');
  }

  const effFlow = (w && w.flow_id) ? String(w.flow_id) : (s.flow_id ? String(s.flow_id) : null);
  if (!effFlow) {
    console.log('-> no flow_id and no widget flow => "לא ידוע"');
    continue;
  }

  let bot = null;
  try {
    bot = await db.collection('bot_flows').findOne(
      { _id: new mongoose.Types.ObjectId(effFlow) },
      { projection: { name: 1, user_id: 1 } }
    );
  } catch { /* invalid ObjectId */ }

  console.log('bot:', bot ? JSON.stringify(bot) : `NOT FOUND (flow ${effFlow} deleted/invalid)`);
  if (bot && String(bot.user_id) !== String(s.user_id)) {
    console.log('-> bot owner differs from session user_id');
  }
}

await mongoose.disconnect();

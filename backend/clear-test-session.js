import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/flowbot');
const r = await mongoose.connection.collection('BotSession').updateMany(
  { sender: '0534198330' },
  { $set: { is_active: false } }
);
console.log('Cleared:', r.modifiedCount, 'sessions');
await mongoose.disconnect();
process.exit(0);

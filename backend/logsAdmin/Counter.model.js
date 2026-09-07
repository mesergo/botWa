import mongoose from 'mongoose';

// Generic atomic-counter collection. Used here to hand out a sequential,
// human-friendly "מס' שגיאה" (error number) for ErrorLog entries without
// depending on Mongo ObjectId ordering.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
}, { collection: 'Counter' });

const Counter = mongoose.model('Counter', counterSchema);

export const nextSequence = async (name) => {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
};

export default Counter;

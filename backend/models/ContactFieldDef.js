import mongoose from 'mongoose';

const contactFieldDefSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  label:   { type: String, required: true },
  order:   { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'ContactFieldDef',
});

contactFieldDefSchema.index({ user_id: 1, order: 1 });

export default mongoose.model('ContactFieldDef', contactFieldDefSchema);

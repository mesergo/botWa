import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema({
  widget_id: String,
  value: String,
  next: String,
  image_url: String,
  operator: String
}, {
  timestamps: true,
  collection: 'options'
});

export default mongoose.model('Option', optionSchema);

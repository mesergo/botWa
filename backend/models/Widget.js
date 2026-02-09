import mongoose from 'mongoose';

const widgetSchema = new mongoose.Schema({
  id: String,
  type: String,
  position: mongoose.Schema.Types.Mixed,
  data: mongoose.Schema.Types.Mixed,
  user_id: String,
  flow_id: String,
  is_first: Number,
  value: String,
  pos_x: Number,
  pos_y: Number,
  next: String,
  standard_process_id: String,
  isStandardProcess: { type: Number, default: 0 },
  image_file: mongoose.Schema.Types.Mixed,
  target_variable: String,
  input_variable: String
}, {
  timestamps: true,
  collection: 'widgets'
});

export default mongoose.model('Widget', widgetSchema);

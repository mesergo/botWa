import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'plans_config'
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: String
}, {
  timestamps: true,
  collection: 'SystemSettings'
});

export default mongoose.model('SystemSetting', systemSettingSchema);

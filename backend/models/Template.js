import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  template_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  isPublic: { type: Boolean, default: true },
  nodes: [mongoose.Schema.Types.Mixed],
  edges: [mongoose.Schema.Types.Mixed]
}, {
  timestamps: true,
  collection: 'predefined_templates'
});

export default mongoose.model('Template', templateSchema);

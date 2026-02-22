import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  template_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  isPublic: { type: Boolean, default: true },
  // type: 'public' = visible to all, 'public_paid' = visible but requires payment, 'admin' = admin-only
  type: { type: String, enum: ['public', 'public_paid', 'admin'], default: 'public' },
  price: { type: Number, default: 0 }, // Price for public_paid templates
  nodes: [mongoose.Schema.Types.Mixed],
  edges: [mongoose.Schema.Types.Mixed]
}, {
  timestamps: true,
  collection: 'predefined_templates'
});

export default mongoose.model('Template', templateSchema);

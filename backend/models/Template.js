import mongoose from 'mongoose';

const templateParamSchema = new mongoose.Schema({
  label: { type: String, required: true },       // Displayed to the user, e.g. "שם החברה"
  variableName: { type: String, required: true }  // Used in content as --variableName--, e.g. "comp_name"
}, { _id: false });

const templateSchema = new mongoose.Schema({
  template_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  isPublic: { type: Boolean, default: true },
  // type: 'public' = visible to all, 'public_paid' = visible but requires payment, 'admin' = admin-only
  type: { type: String, enum: ['public', 'public_paid', 'admin'], default: 'public' },
  price: { type: Number, default: 0 }, // Price for public_paid templates
  // Parameters the user fills in before using this template
  params: { type: [templateParamSchema], default: [] },
  nodes: [mongoose.Schema.Types.Mixed],
  edges: [mongoose.Schema.Types.Mixed]
}, {
  timestamps: true,
  collection: 'predefined_templates'
});

export default mongoose.model('Template', templateSchema);

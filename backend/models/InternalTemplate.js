import mongoose from 'mongoose';

const internalTemplateSchema = new mongoose.Schema({
  // Owner account id (via getEffectiveUserId) - all users on the account share these templates
  userId: { type: String, required: true, index: true },
  // Template name shown in the "/" picker
  name: { type: String, required: true },
  // Body text, supports numbered placeholders like {{1}}, {{2}}
  body: { type: String, required: true },
  // Optional single header attachment
  mediaType: { type: String, enum: ['image', 'video', 'document', null], default: null },
  mediaUrl: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'internal_templates'
});

export default mongoose.model('InternalTemplate', internalTemplateSchema);

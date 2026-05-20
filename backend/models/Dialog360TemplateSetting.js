import mongoose from 'mongoose';

const dialog360TemplateSettingSchema = new mongoose.Schema({
  // The name/elementName of the Dialog360 template
  templateName: { type: String, required: true },
  // The ID from Dialog360 (if available)
  templateId: { type: String },
  // Whether to show this template when typing "/" in chat (default: true)
  showInChat: { type: Boolean, default: true },
  // User ID (if we want per-user settings) - optional
  userId: { type: String },
  // Language of the template
  language: { type: String },
  // Additional metadata
  category: { type: String },
  status: { type: String }
}, {
  timestamps: true,
  collection: 'dialog360_template_settings'
});

// Create compound index for efficient lookups
dialog360TemplateSettingSchema.index({ templateName: 1, userId: 1 });

export default mongoose.model('Dialog360TemplateSetting', dialog360TemplateSettingSchema);

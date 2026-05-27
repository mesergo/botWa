import mongoose from 'mongoose';

const dialog360TemplateSettingSchema = new mongoose.Schema({
  // The name/elementName of the Dialog360 template
  templateName: { type: String, required: true },
  // The ID from Dialog360 (if available)
  templateId: { type: String },
  // Whether to show this template when typing "/" in chat (default: true)
  // Kept for backward compatibility — derived from `visibility` (true if not 'hidden').
  showInChat: { type: Boolean, default: true },
  // Visibility level:
  //   'hidden'  – hidden from everyone (managers and agents)
  //   'manager' – visible to shift managers and company managers only (default)
  //   'agent'   – visible to agents (reps) as well as managers
  visibility: { type: String, enum: ['hidden', 'manager', 'agent'], default: 'manager' },
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

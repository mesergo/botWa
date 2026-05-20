import Dialog360TemplateSetting from '../models/Dialog360TemplateSetting.js';
import { getEffectiveUserId } from '../middleware/auth.js';

/**
 * Get all Dialog360 template settings for the authenticated user
 */
export const getTemplateSettings = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const settings = await Dialog360TemplateSetting.find({ userId });
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get a single template setting by name
 */
export const getTemplateSetting = async (req, res) => {
  try {
    const { templateName } = req.params;
    const userId = getEffectiveUserId(req);
    
    const setting = await Dialog360TemplateSetting.findOne({ templateName, userId });
    if (!setting) {
      // Return default if not found
      return res.json({ templateName, showInChat: true });
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update or create template setting (toggle showInChat)
 */
export const toggleShowInChat = async (req, res) => {
  try {
    const { templateName, templateId, language, category, status, showInChat } = req.body;
    const userId = getEffectiveUserId(req);
    
    if (!templateName) {
      return res.status(400).json({ error: 'templateName is required' });
    }

    const update = {
      showInChat,
      templateId,
      language,
      category,
      status,
      userId
    };

    const setting = await Dialog360TemplateSetting.findOneAndUpdate(
      { templateName, userId },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ success: true, setting });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a template setting
 */
export const deleteTemplateSetting = async (req, res) => {
  try {
    const { templateName } = req.params;
    const userId = getEffectiveUserId(req);
    
    await Dialog360TemplateSetting.deleteOne({ templateName, userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

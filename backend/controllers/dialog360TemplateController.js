import Dialog360TemplateSetting from '../models/Dialog360TemplateSetting.js';
import { getEffectiveUserId } from '../middleware/auth.js';

// Normalize a stored setting: ensure `visibility` is set even on legacy records
// that only had the boolean `showInChat` field.
const normalizeSetting = (s) => {
  if (!s) return s;
  const obj = typeof s.toObject === 'function' ? s.toObject() : { ...s };
  if (!obj.visibility) {
    obj.visibility = obj.showInChat === false ? 'hidden' : 'manager';
  }
  if (obj.showInChat === undefined || obj.showInChat === null) {
    obj.showInChat = obj.visibility !== 'hidden';
  }
  return obj;
};

/**
 * Get all Dialog360 template settings for the authenticated user
 */
export const getTemplateSettings = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const settings = await Dialog360TemplateSetting.find({ userId });
    res.json({
      success: true,
      role: req.user?.role || null,
      settings: settings.map(normalizeSetting),
    });
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
      return res.json({ templateName, showInChat: true, visibility: 'manager' });
    }
    res.json(normalizeSetting(setting));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update or create template setting (toggle showInChat / visibility)
 */
export const toggleShowInChat = async (req, res) => {
  try {
    const { templateName, templateId, language, category, status, showInChat, visibility } = req.body;
    const userId = getEffectiveUserId(req);
    
    if (!templateName) {
      return res.status(400).json({ error: 'templateName is required' });
    }

    // Resolve effective visibility from the request:
    //   - explicit `visibility` field wins
    //   - otherwise derive from `showInChat` (false => hidden, true => manager)
    let effectiveVisibility = visibility;
    if (!effectiveVisibility) {
      effectiveVisibility = showInChat === false ? 'hidden' : 'manager';
    }
    if (!['hidden', 'manager', 'agent'].includes(effectiveVisibility)) {
      return res.status(400).json({ error: 'visibility must be one of: hidden, manager, agent' });
    }

    const update = {
      visibility: effectiveVisibility,
      showInChat: effectiveVisibility !== 'hidden',
      templateId,
      language,
      category,
      status,
      userId,
    };

    const setting = await Dialog360TemplateSetting.findOneAndUpdate(
      { templateName, userId },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ success: true, setting: normalizeSetting(setting) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 

/**
 * Set (or clear) the default header media (image/video/document) for a template.
 * When set, agents sending this template in chat can reuse it instead of
 * uploading a new file each time.
 */
export const setDefaultMedia = async (req, res) => {
  try {
    const { templateName, templateId, url, mediaType } = req.body;
    const userId = getEffectiveUserId(req);

    if (!templateName) {
      return res.status(400).json({ error: 'templateName is required' });
    }
    if (url && !['image', 'video', 'document'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be one of: image, video, document' });
    }

    const update = {
      templateId,
      defaultHeaderMediaUrl: url || null,
      defaultHeaderMediaType: url ? mediaType : null,
      userId,
    };

    const setting = await Dialog360TemplateSetting.findOneAndUpdate(
      { templateName, userId },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ success: true, setting: normalizeSetting(setting) });
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

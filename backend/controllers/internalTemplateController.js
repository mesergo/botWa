import InternalTemplate from '../models/InternalTemplate.js';
import { getEffectiveUserId } from '../middleware/auth.js';

/**
 * List all internal templates for the account (visible to all roles).
 */
export const listInternalTemplates = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const templates = await InternalTemplate.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a new internal template.
 */
export const createInternalTemplate = async (req, res) => {
  try {
    const { name, body, mediaType, mediaUrl } = req.body;
    const userId = getEffectiveUserId(req);

    if (!name || !body) {
      return res.status(400).json({ error: 'name and body are required' });
    }
    if (mediaUrl && !['image', 'video', 'document'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be one of: image, video, document' });
    }

    const template = await InternalTemplate.create({
      userId,
      name,
      body,
      mediaType: mediaUrl ? mediaType : null,
      mediaUrl: mediaUrl || ''
    });

    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update an existing internal template (must belong to the same account).
 */
export const updateInternalTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, body, mediaType, mediaUrl } = req.body;
    const userId = getEffectiveUserId(req);

    if (!name || !body) {
      return res.status(400).json({ error: 'name and body are required' });
    }
    if (mediaUrl && !['image', 'video', 'document'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be one of: image, video, document' });
    }

    const template = await InternalTemplate.findOneAndUpdate(
      { _id: id, userId },
      { $set: { name, body, mediaType: mediaUrl ? mediaType : null, mediaUrl: mediaUrl || '' } },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete an internal template (must belong to the same account).
 */
export const deleteInternalTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getEffectiveUserId(req);

    const result = await InternalTemplate.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

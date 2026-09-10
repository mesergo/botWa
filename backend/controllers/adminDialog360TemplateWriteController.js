import { resolveDialog360BotId, callDialog360TemplateAction } from '../utils/dialog360TemplatesApi.js';

// POST /api/admin/users/:userId/dialog360-templates/add
// Create a new WhatsApp message template on behalf of a customer.
export const addUserDialog360Template = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, category, language, components } = req.body;

    if (!name || !category || !language || !Array.isArray(components)) {
      return res.status(400).json({
        error: 'name, category, language and components are required',
        success: false
      });
    }

    const botId = await resolveDialog360BotId(userId);
    if (!botId) {
      return res.status(400).json({
        error: 'Dialog360 Bot ID not configured for this customer.',
        success: false
      });
    }

    const { ok, status, data } = await callDialog360TemplateAction(botId, 'add_template', {
      name, category, language, components
    });

    if (!ok) {
      return res.status(status).json({
        error: data?.error || data?.message || `Dialog360 API returned status ${status}`,
        details: data,
        success: false
      });
    }

    res.json({ success: true, result: data });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
};

// POST /api/admin/users/:userId/dialog360-templates/edit
// Edit an existing WhatsApp message template on behalf of a customer.
// Note: the external gateway forwards this to the Facebook Graph API and
// requires the customer's account to have `fbApiKey` configured — if not,
// the gateway responds with an error which we pass through as-is.
export const editUserDialog360Template = async (req, res) => {
  try {
    const { userId } = req.params;
    const { template_id, category, components } = req.body;

    if (!template_id || !Array.isArray(components)) {
      return res.status(400).json({
        error: 'template_id and components are required',
        success: false
      });
    }

    const botId = await resolveDialog360BotId(userId);
    if (!botId) {
      return res.status(400).json({
        error: 'Dialog360 Bot ID not configured for this customer.',
        success: false
      });
    }

    const { ok, status, data } = await callDialog360TemplateAction(botId, 'edit_template', {
      template_id, category, components
    });

    if (!ok) {
      return res.status(status).json({
        error: data?.error || data?.message || `Dialog360 API returned status ${status}`,
        details: data,
        success: false
      });
    }

    res.json({ success: true, result: data });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
};

// POST /api/admin/users/:userId/dialog360-templates/delete
// Delete a WhatsApp message template on behalf of a customer.
export const deleteUserDialog360Template = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required', success: false });
    }

    const botId = await resolveDialog360BotId(userId);
    if (!botId) {
      return res.status(400).json({
        error: 'Dialog360 Bot ID not configured for this customer.',
        success: false
      });
    }

    const { ok, status, data } = await callDialog360TemplateAction(botId, 'delete_template', { name });

    if (!ok) {
      return res.status(status).json({
        error: data?.error || data?.message || `Dialog360 API returned status ${status}`,
        details: data,
        success: false
      });
    }

    res.json({ success: true, result: data });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
};

import SmsDestSetting from '../../models/SmsDestSetting.js';

function toClientShape(doc) {
  const assignedId = doc.assignedClientId || null;
  return {
    dest: doc.dest,
    assignedClientId: assignedId,
    assignedClientName: doc.assignedClientName || '',
    // Frontend DestSetting.assignedClients — store stable user id when present
    assignedClients: assignedId ? [assignedId] : [],
    googleSheetsUrl: doc.googleSheetsUrl || '',
    webhookUrl: doc.webhookUrl || '',
    isActive: !!doc.isActive,
    notes: doc.notes || '',
  };
}

/**
 * GET /api/sms-in/dest-settings
 * Always scoped to the logged-in user (admin accounts included).
 */
export async function getDestSettings(req, res) {
  try {
    const userId = req.userId;
    const docs = await SmsDestSetting.find({ assignedClientId: userId }).sort({ dest: 1 }).lean();

    res.json({
      settings: docs.map(toClientShape),
      source: 'mongodb',
      scoped: true,
    });
  } catch (err) {
    console.error('[sms-in] getDestSettings error:', err);
    res.status(500).json({ error: err.message || 'Failed to load dest settings' });
  }
}

/**
 * GET /api/sms-in/admin/dest-settings
 * /admin panel only — ALWAYS every line. Protected by requireAdmin.
 */
export async function getAdminDestSettings(req, res) {
  try {
    const docs = await SmsDestSetting.find({}).sort({ dest: 1 }).lean();

    res.json({
      settings: docs.map(toClientShape),
      source: 'mongodb',
      scoped: false,
    });
  } catch (err) {
    console.error('[sms-in] getAdminDestSettings error:', err);
    res.status(500).json({ error: err.message || 'Failed to load dest settings' });
  }
}

/**
 * PUT /api/sms-in/dest-settings/:dest
 * Admin only — upsert line assignment / routing config.
 */
export async function upsertDestSetting(req, res) {
  try {
    const dest = decodeURIComponent(req.params.dest || '').trim();
    if (!dest) {
      return res.status(400).json({ error: 'dest is required' });
    }

    const {
      assignedClientId = null,
      assignedClientName = '',
      assignedClients,
      googleSheetsUrl = '',
      webhookUrl = '',
      isActive = false,
      notes = '',
    } = req.body || {};

    // Accept either assignedClientId or first entry of assignedClients (id)
    const clientId =
      assignedClientId ||
      (Array.isArray(assignedClients) && assignedClients[0] ? assignedClients[0] : null) ||
      null;

    const doc = await SmsDestSetting.findOneAndUpdate(
      { dest },
      {
        dest,
        assignedClientId: clientId,
        assignedClientName: assignedClientName || '',
        googleSheetsUrl: googleSheetsUrl || '',
        webhookUrl: webhookUrl || '',
        isActive: !!isActive,
        notes: notes || '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ setting: toClientShape(doc), success: true });
  } catch (err) {
    console.error('[sms-in] upsertDestSetting error:', err);
    res.status(500).json({ error: err.message || 'Failed to save dest setting' });
  }
}

/** Dest numbers assigned to a given user id */
export async function getAssignedDestsForUser(userId) {
  if (!userId) return [];
  const docs = await SmsDestSetting.find({ assignedClientId: userId }).select('dest').lean();
  return docs.map((d) => d.dest);
}

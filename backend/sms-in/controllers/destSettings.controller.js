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
    createdAt: doc.createdAt || null,
  };
}

/**
 * Account that SMS lines are assigned to. Lines are only ever assigned to owner
 * accounts (see clients.controller — reps are excluded from the client pool), so
 * a sub-user must resolve to its manager to see the account's lines.
 */
export function getSmsOwnerId(req) {
  return req.user?.manager_id || req.userId;
}

/**
 * GET /api/sms-in/dest-settings
 * Always scoped to the logged-in account (admin accounts included).
 */
export async function getDestSettings(req, res) {
  try {
    const userId = getSmsOwnerId(req);
    const docs = await SmsDestSetting.find({ assignedClientId: userId }).sort({ createdAt: -1 }).lean();

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
    const docs = await SmsDestSetting.find({}).sort({ createdAt: -1 }).lean();

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

/**
 * POST /api/sms-in/admin/dest-settings/bulk-assign
 * Admin only — bulk upsert a list of dest numbers to a single client.
 * Always overwrites any existing assignment (last write wins).
 */
export async function bulkAssignDestSettings(req, res) {
  try {
    const { dests, assignedClientId, assignedClientName = '' } = req.body || {};

    if (!assignedClientId) {
      return res.status(400).json({ error: 'assignedClientId is required' });
    }

    if (!Array.isArray(dests)) {
      return res.status(400).json({ error: 'dests must be an array' });
    }

    const cleanedDests = [...new Set(dests.map((d) => String(d || '').trim()).filter(Boolean))];

    if (cleanedDests.length === 0) {
      return res.status(400).json({ error: 'dests must contain at least one valid number' });
    }

    const ops = cleanedDests.map((dest) => ({
      updateOne: {
        filter: { dest },
        update: {
          $set: {
            dest,
            assignedClientId,
            assignedClientName: assignedClientName || '',
            isActive: true,
            notes: 'נוסף משיוך מספרים מרוכז',
            updatedAt: new Date(),
          },
          // bulkWrite bypasses mongoose timestamps middleware, so stamp createdAt
          // manually — only applied when the upsert actually inserts a new doc.
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    }));

    const result = await SmsDestSetting.bulkWrite(ops);

    res.json({
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
      total: cleanedDests.length,
    });
  } catch (err) {
    console.error('[sms-in] bulkAssignDestSettings error:', err);
    res.status(500).json({ error: err.message || 'Failed to bulk assign dest settings' });
  }
}

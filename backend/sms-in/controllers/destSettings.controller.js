import SmsDestSetting from '../../models/SmsDestSetting.js';
import { getSmsCollection } from '../smsDb.js';

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
    // Set by the /reg wizard's request-number call — cleared once a rep actually
    // assigns the line (see upsertDestSetting below). Only meaningful when unassigned.
    pendingCustomerName: assignedId ? '' : (doc.pendingCustomerName || ''),
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
        // A rep completing the real assignment clears the /reg wizard's "pending" marker.
        ...(clientId ? { pendingCustomerName: '' } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ setting: toClientShape(doc), success: true });
  } catch (err) {
    console.error('[sms-in] upsertDestSetting error:', err);
    res.status(500).json({ error: err.message || 'Failed to save dest setting' });
  }
}

// Flat monthly price shown for every available number in the /reg onboarding wizard.
// The dest-settings schema has no price/region field — this is a single system-wide
// constant, not per-number data, per product decision (no region breakdown either).
const ONBOARDING_NUMBER_PRICE = 39;

/**
 * GET /api/sms-in/available-numbers
 * Public (no auth) — powers the virtual-number picker in the /reg onboarding wizard,
 * where the visitor has no account yet.
 *
 * "Real" numbers = every dest that has actually received SMS traffic, queried live
 * from the external ilbot DB (SMS_MONGODB_URI, see backend/sms-in/smsDb.js) — confirmed
 * against admin data this is the authoritative numbers inventory, NOT sms_dest_settings
 * (which only has rows for numbers someone manually configured/assigned).
 * "Available" = not already assigned AND not already picked by someone else pending
 * a rep's manual assignment (SmsDestSetting.assignedClientId / pendingCustomerName).
 */
export async function getAvailableNumbers(req, res) {
  try {
    const smsColl = await getSmsCollection();
    if (!smsColl) {
      return res.status(503).json({ error: 'sms_db_unavailable', numbers: [] });
    }
    const rawDests = await smsColl.distinct('dest');
    const allDests = Array.from(new Set(rawDests.map((d) => String(d || '').trim()).filter(Boolean)));

    const settings = await SmsDestSetting.find({ dest: { $in: allDests } })
      .select('dest assignedClientId pendingCustomerName')
      .lean();
    const takenDests = new Set(
      settings.filter((s) => s.assignedClientId || s.pendingCustomerName).map((s) => s.dest)
    );

    const available = allDests.filter((d) => !takenDests.has(d)).sort().slice(0, 20);

    res.json({
      numbers: available.map((number) => ({ number, price: ONBOARDING_NUMBER_PRICE })),
    });
  } catch (err) {
    console.error('[sms-in] getAvailableNumbers error:', err);
    res.status(500).json({ error: err.message || 'Failed to load available numbers' });
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
            pendingCustomerName: '',
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

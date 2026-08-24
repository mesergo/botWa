import SmsExternalLog from '../../models/SmsExternalLog.js';

/**
 * POST /api/sms-in/external-log
 * Protected by requireApiKey (x-api-key header). Called by the external
 * "maskyoo" project so a copy of every incoming SMS is also stored in our own
 * MongoDB (collection: sms). Does not touch the external ilbot SMS DB used by
 * the rest of sms-in.
 */
export async function createExternalLog(req, res, next) {
  const { appName, dest, phone, message, date } = req.body;

  if (!dest || !phone || !message) {
    return res.status(400).json({
      error: 'Missing required fields (dest, phone, message)',
    });
  }

  try {
    const doc = await SmsExternalLog.create({ appName, dest, phone, message, date });
    res.json({ success: true, id: doc._id });
  } catch (err) {
    next(err);
  }
}

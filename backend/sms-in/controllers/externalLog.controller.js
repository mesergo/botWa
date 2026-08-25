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

/**
 * GET /api/sms-in/admin/external-log
 * /admin panel only (requireAdmin). Lists every entry logged via
 * POST /external-log (the "maskyoo" copy stored in our own MongoDB, collection
 * `sms`). Supports free-text search and paging, mirroring the shape of
 * getAdminMessages so the admin UI can reuse the same table/pagination logic.
 */ 
export async function getAdminExternalLogs(req, res, next) {
  try {
    const search = String(req.query.q || '').trim();
    const requestedLimit = Number(req.query.limit);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50, 1), 100);
    const requestedPage = Number(req.query.page);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

    const filter = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ phone: regex }, { dest: regex }, { message: regex }, { appName: regex }];
    }

    const destQuery = String(req.query.dest || '').trim();
    if (destQuery) {
      filter.dest = new RegExp(destQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const dateStart = String(req.query.dateStart || '').trim();
    const dateEnd = String(req.query.dateEnd || '').trim();
    if (dateStart || dateEnd) {
      filter.createdAt = {};
      if (dateStart) {
        const start = new Date(dateStart);
        if (!Number.isNaN(start.getTime())) filter.createdAt.$gte = start;
      }
      if (dateEnd) {
        const end = new Date(dateEnd);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    const [logs, total] = await Promise.all([
      SmsExternalLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SmsExternalLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit });
  } catch (err) {
    next(err);
  }
}

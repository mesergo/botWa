import jwt from 'jsonwebtoken';
import ErrorLog from './ErrorLog.model.js';
import User from '../models/User.js';
import { logError, flushFallbackErrorLog } from './errorLogger.js';
import { SECRET_KEY } from '../middleware/auth.js';

const PAGE_LIMIT = 50;

// GET /api/admin/error-logs — paginated + filtered list for the "תיעוד שגיאות" admin tab.
// Shape mirrors getRemovalConfigLog in adminController.js.
export const listErrorLogs = async (req, res) => {
  try {
    // Belt-and-suspenders: normally the mongoose 'connected' event already
    // replays anything written while the database was down, but if the tab
    // is opened right as the connection recovers, catch it here too.
    await flushFallbackErrorLog().catch(() => {});

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * PAGE_LIMIT;

    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.clientId) filter.client_id = req.query.clientId;
    if (req.query.clientName) filter.client_name = { $regex: req.query.clientName, $options: 'i' };
    if (req.query.dateStart || req.query.dateEnd) {
      filter.createdAt = {};
      if (req.query.dateStart) filter.createdAt.$gte = new Date(req.query.dateStart);
      if (req.query.dateEnd) filter.createdAt.$lte = new Date(`${req.query.dateEnd}T23:59:59.999Z`);
    }

    const [entries, total] = await Promise.all([
      ErrorLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_LIMIT).lean(),
      ErrorLog.countDocuments(filter),
    ]);

    res.json({ entries, total, page, pages: Math.ceil(total / PAGE_LIMIT) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching error log', error: error.message });
  }
};

// GET /api/admin/error-logs/meta — distinct filter options for the tab's filter bar.
export const getErrorLogMeta = async (req, res) => {
  try {
    const [categories, clients] = await Promise.all([
      ErrorLog.distinct('category'),
      ErrorLog.aggregate([
        { $match: { client_id: { $ne: null } } },
        { $group: { _id: '$client_id', client_name: { $last: '$client_name' } } },
        { $sort: { client_name: 1 } },
      ]),
    ]);
    res.json({
      categories,
      clients: clients.map(c => ({ id: c._id, name: c.client_name || String(c._id) })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching error log filters', error: error.message });
  }
};

// POST /api/admin/error-logs/report — ingestion endpoint for the frontend
// window.fetch interceptor (see frontend/components/logsAdmin/reportClientError.ts)
// and the global crash safety net (ErrorBoundary / window.onerror). Deliberately
// NOT behind authenticateToken: a client can hit an error while logged out
// (e.g. a failed login attempt), and this must never itself fail the caller.
export const reportClientError = async (req, res) => {
  // Never let a malformed report break the UI further — always 204.
  res.sendStatus(204);

  try {
    const { message, url, status, kind, stack, details } = req.body || {};

    let clientId = null;
    let clientName = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        clientId = decoded?.id || null;
        if (clientId) {
          const user = await User.findById(clientId).select('name').lean();
          clientName = user?.name || null;
        }
      } catch (_) { /* anonymous/expired token — log without attribution */ }
    }

    await logError({
      category: kind === 'network' ? 'network' : 'client_ui',
      source: url || 'frontend',
      message: message || (status ? `HTTP ${status}` : 'Client-side error'),
      clientId,
      clientName,
      statusCode: status || null,
      stack: stack || null,
      details: details || null,
    });
  } catch (err) {
    console.error('[ErrorLog] Failed to record client-reported error:', err.message);
  }
};

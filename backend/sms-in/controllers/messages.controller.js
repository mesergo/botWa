import * as smsService from '../services/sms.service.js';
import { getSmsDbName, getSmsCollectionName } from '../repositories/sms.repository.js';
import { getAssignedDestsForUser } from './destSettings.controller.js';

/**
 * Regular / user SMS tab — always scoped to the logged-in account's lines
 * (admin user accounts included).
 *
 * Important: never "fetch global recent then filter in memory". On a busy inbox
 * the customer's messages can fall outside the latest N rows and disappear even
 * though the line is assigned. Always query Mongo by allowed dests.
 */
export async function getMessages(req, res, next) {
  try { 
    const search = String(req.query.q || '').trim();
    const destQuery = String(req.query.dest || '').trim();
    const exportAll = String(req.query.exportAll || '').trim() === 'true';
    const requestedLimit = Number(req.query.limit);
    const limit = exportAll
      ? Math.min(Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 50000, 50000)
      : Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50, 1), 100);
    const requestedPage = Number(req.query.page);
    const page = exportAll
      ? 1
      : Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;

    // Authenticated callers are always scoped to assigned lines.
    let allowedDests;
    if (req.user) {
      allowedDests = await getAssignedDestsForUser(req.userId);
      if (allowedDests.length === 0) {
        return res.json({
          source: 'mongodb',
          dbName: getSmsDbName(),
          collection: getSmsCollectionName(),
          messages: [],
          total: 0,
          page,
          limit,
          scoped: true,
        });
      }
    }

    // Always page through Mongo with skip/limit (never a fixed "recent N" cap) so
    // browsing keeps going past any page and `total` always reflects the true count.
    const result = await smsService.searchMessages({
      search,
      destQuery,
      allowedDests,
      page,
      limit,
    });

    res.json({
      source: 'mongodb',
      dbName: getSmsDbName(),
      collection: getSmsCollectionName(),
      messages: result.messages,
      total: result.total,
      page,
      limit,
      scoped: !!req.user,
    });
  } catch (err) {
    if (err.message === 'Database not configured') {
      return res.json({
        source: 'local_storage_fallback',
        messages: [],
        localDev: process.env.NODE_ENV !== 'production',
      });
    }
    next(err);
  }
}

/**
 * /admin panel only — ALWAYS every message in the system.
 * No line scoping. Protected by requireAdmin.
 */
export async function getAdminMessages(req, res, next) {
  try {
    const search = String(req.query.q || '').trim();
    const destQuery = String(req.query.dest || '').trim();
    const exportAll = String(req.query.exportAll || '').trim() === 'true';
    const requestedLimit = Number(req.query.limit);
    const limit = exportAll
      ? Math.min(Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 50000, 50000)
      : Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50, 1), 100);
    const requestedPage = Number(req.query.page);
    const page = exportAll
      ? 1
      : Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;

    // Always page through Mongo with skip/limit (no fixed "recent N" cap) so browsing
    // keeps going past any page and `total` always reflects the true count.
    const result = await smsService.searchMessages({
      search,
      destQuery,
      // no allowedDests → entire collection
      page,
      limit,
    });

    res.json({
      source: 'mongodb',
      dbName: getSmsDbName(),
      collection: getSmsCollectionName(),
      messages: result.messages,
      total: result.total,
      page,
      limit,
      scoped: false,
    });
  } catch (err) {
    if (err.message === 'Database not configured') {
      return res.json({
        source: 'local_storage_fallback',
        messages: [],
        localDev: process.env.NODE_ENV !== 'production',
      });
    }
    next(err);
  }
}

/**
 * Regular / user SMS tab — dest numbers that actually have at least one message,
 * scoped to the logged-in account's assigned lines. Powers the dest-filter
 * dropdown so suggestions never point to a guaranteed-empty search.
 */
export async function getDests(req, res, next) {
  try {
    let allowedDests;
    if (req.user) {
      allowedDests = await getAssignedDestsForUser(req.userId);
      if (allowedDests.length === 0) {
        return res.json({ dests: [] });
      }
    }
    const dests = await smsService.getDistinctDests(allowedDests);
    res.json({ dests });
  } catch (err) {
    if (err.message === 'Database not configured') {
      return res.json({ dests: [] });
    }
    next(err);
  }
}

/**
 * /admin panel only — every dest number in the system that actually has messages.
 */
export async function getAdminDests(req, res, next) {
  try {
    const dests = await smsService.getDistinctDests();
    res.json({ dests });
  } catch (err) {
    if (err.message === 'Database not configured') {
      return res.json({ dests: [] });
    }
    next(err);
  }
}

export async function createMessage(req, res, next) {
  const { dest, phone, date, message } = req.body;

  if (!dest || !phone || !message) {
    return res.status(400).json({
      error: 'Missing required SMS fields (dest, phone, message)',
    });
  }

  try {
    const created = await smsService.createMessage({ dest, phone, date, message });

    res.json({
      success: true,
      id_: created.id_,
      message: 'SMS logged successfully to MongoDB!',
    });
  } catch (err) {
    if (err.message === 'Database not configured') {
      return res.json({
        success: false,
        localOnly: true,
        message: 'SMS saved locally only — DB unavailable in dev',
      });
    }
    next(err);
  }
}

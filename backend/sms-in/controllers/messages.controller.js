import * as smsService from '../services/sms.service.js';
import { getSmsDbName, getSmsCollectionName } from '../repositories/sms.repository.js';
import { getAssignedDestsForUser } from './destSettings.controller.js';

function isFullAccess(req) {
  // Real admin (not impersonating a customer) sees everything
  return req.user?.role === 'admin' && !req.user?.isImpersonating;
}

async function filterMessagesForUser(req, messages) {
  if (!req.user || isFullAccess(req)) return messages;

  const userId = req.userId;
  const assignedDests = await getAssignedDestsForUser(userId);
  if (assignedDests.length === 0) return [];

  const allowed = new Set(assignedDests);
  return messages.filter((m) => allowed.has(m.dest));
}

export async function getMessages(req, res, next) {
  try {
    const search = String(req.query.q || '').trim();
    const destQuery = String(req.query.dest || '').trim();
    const isSearch = search.length > 0 || destQuery.length > 0;
    const requestedLimit = Number(req.query.limit);
    const limit = isSearch
      ? Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50, 1), 100)
      : Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 500, 1), 500);
    const requestedPage = Number(req.query.page);
    const page = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;

    let messages;
    let total;

    if (isSearch) {
      let allowedDests;
      if (req.user && !isFullAccess(req)) {
        allowedDests = await getAssignedDestsForUser(req.userId);
      }
      const result = await smsService.searchMessages({
        search,
        destQuery,
        allowedDests,
        page,
        limit,
      });
      messages = result.messages;
      total = result.total;
    } else {
      messages = await smsService.getRecentMessages(limit);
      messages = await filterMessagesForUser(req, messages);
      total = messages.length;
    }

    res.json({
      source: 'mongodb',
      dbName: getSmsDbName(),
      collection: getSmsCollectionName(),
      messages,
      total,
      page,
      limit,
      mode: isSearch ? 'search' : 'recent',
      scoped: !isFullAccess(req) && !!req.user,
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

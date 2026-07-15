import * as smsService from '../services/sms.service.js';
import { getSmsDbName, getSmsCollectionName } from '../repositories/sms.repository.js';
import { DEMO_MESSAGES } from '../data/demoMessages.js';
import { formatDemoMessage } from '../utils/smsFormatter.js';
import { isDemoSeedEnabled } from '../services/demoSeed.service.js';
import { getAssignedDestsForUser } from './destSettings.controller.js';

function getDemoMessagesPayload() {
  return {
    source: 'demo',
    localDev: true,
    demoMode: true,
    messages: DEMO_MESSAGES.map(formatDemoMessage),
  };
}

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
    const limit = Number(req.query.limit) || 500;
    let messages = await smsService.getRecentMessages(limit);
    messages = await filterMessagesForUser(req, messages);

    res.json({
      source: 'mongodb',
      demoMode: isDemoSeedEnabled(),
      dbName: getSmsDbName(),
      collection: getSmsCollectionName(),
      messages,
      scoped: !isFullAccess(req) && !!req.user,
    });
  } catch (err) {
    if (err.message === 'Database not configured') {
      if (isDemoSeedEnabled()) {
        const payload = getDemoMessagesPayload();
        payload.messages = await filterMessagesForUser(req, payload.messages);
        payload.scoped = !isFullAccess(req) && !!req.user;
        return res.json(payload);
      }
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

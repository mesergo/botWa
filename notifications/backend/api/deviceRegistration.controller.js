/**
 * Device registration + test-push + bot-lines controller.
 * Identity and tenant from authenticated session only.
 */

import { parseRegisterDeviceDto } from './dto.js';
import { NotificationModuleError, UnauthorizedError, ValidationError } from '../domain/errors.js';
import { getFirebaseAdminInitError, isFirebaseAdminReady } from '../infrastructure/firebase/firebaseAdmin.js';

/**
 * Resolve identity strictly from the authenticated request.
 * tenantId = account owner (getEffectiveUserId pattern).
 *
 * @param {import('express').Request} req
 * @returns {{ userId: string, tenantId: string, role: string|undefined }}
 */
export function resolveSessionIdentity(req) {
  const userId = req.userId || req.user?.id || req.user?._id;
  const role = req.user?.role;
  const isSubUser =
    (role === 'rep' || role === 'rep_manager' || role === 'rep_bot') && req.user?.manager_id;
  const tenantId = isSubUser ? req.user.manager_id : userId;

  if (!userId || !tenantId) {
    throw new UnauthorizedError('Authenticated session required');
  }

  return { userId: String(userId), tenantId: String(tenantId), role };
}

/**
 * Bot lines the current user may subscribe to (tenant-owned, optionally allowed_bot_ids).
 * @param {{ tenantId: string, userId: string }} identity
 */
async function listAllowedBotLines(identity) {
  // From notifications/backend/api → project root is ../../../ (not ../../../../)
  const BotFlow = (await import('../../../backend/models/BotFlow.js')).default;
  const User = (await import('../../../backend/models/User.js')).default;

  const bots = await BotFlow.find({ user_id: identity.tenantId })
    .select('_id name display_phone_number phone_number_id')
    .lean();

  let allowed = bots.map((b) => ({
    id: String(b._id),
    name: b.name || 'בוט',
    displayPhone: b.display_phone_number || '',
  }));

  const userDoc = await User.findById(identity.userId).select('allowed_bot_ids').lean();
  const allowedIds = (userDoc?.allowed_bot_ids || []).map(String).filter(Boolean);
  if (allowedIds.length) {
    const set = new Set(allowedIds);
    allowed = allowed.filter((b) => set.has(b.id));
  }

  return allowed;
}

/**
 * @param {import('../application/NotificationService.js').NotificationService} notificationService
 */
export function createDeviceRegistrationController(notificationService) {
  return {
    /**
     * GET /bot-lines
     */
    async listBotLines(req, res) {
      try {
        const identity = resolveSessionIdentity(req);
        const botLines = await listAllowedBotLines(identity);
        res.status(200).json({ success: true, botLines });
      } catch (err) {
        return sendError(res, err);
      }
    },

    /**
     * POST /registrations
     */
    async register(req, res) {
      try {
        const identity = resolveSessionIdentity(req);
        const dto = parseRegisterDeviceDto(req.body);

        if (!dto.allBotLines) {
          const allowed = await listAllowedBotLines(identity);
          const allowedSet = new Set(allowed.map((b) => b.id));
          const invalid = (dto.botLineIds || []).filter((id) => !allowedSet.has(id));
          if (invalid.length) {
            throw new ValidationError('One or more botLineIds do not belong to this account');
          }
        }

        const record = await notificationService.registerDevice({
          userId: identity.userId,
          tenantId: identity.tenantId,
          fid: dto.fid,
          userAgent: dto.userAgent || req.headers['user-agent'],
          platform: dto.platform || 'web',
          allBotLines: dto.allBotLines,
          botLineIds: dto.botLineIds,
        });

        // #region agent log
        fetch('http://127.0.0.1:7501/ingest/0789c8a9-ec04-46d0-a0a5-fa708615c1d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d13302'},body:JSON.stringify({sessionId:'d13302',runId:'tenant-model',hypothesisId:'H-register',location:'deviceRegistration.controller.js:register',message:'FID registered with bot prefs',data:{userId:identity.userId,tenantId:identity.tenantId,allBotLines:record.allBotLines,botLineCount:(record.botLineIds||[]).length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        res.status(200).json({
          success: true,
          registration: {
            id: record.id,
            platform: record.platform,
            enabled: record.enabled,
            allBotLines: record.allBotLines,
            botLineIds: record.botLineIds,
            updatedAt: record.updatedAt,
          },
        });
      } catch (err) {
        return sendError(res, err);
      }
    },

    /**
     * DELETE /registrations/:fid
     */
    async unregister(req, res) {
      try {
        const identity = resolveSessionIdentity(req);
        const fid = String(req.params.fid || '').trim();
        if (!fid) {
          throw new ValidationError('fid path parameter is required');
        }
        const removed = await notificationService.unregisterDevice({
          userId: identity.userId,
          fid,
        });
        res.status(200).json({ success: true, deactivated: removed });
      } catch (err) {
        return sendError(res, err);
      }
    },

    /**
     * POST /test
     */
    async test(req, res) {
      try {
        const isDev = (process.env.NODE_ENV || 'development') !== 'production';
        const isAdmin = req.user?.role === 'admin';
        if (!isDev && !isAdmin) {
          return res.status(403).json({ success: false, error: 'Test endpoint available in development only' });
        }

        if (!isFirebaseAdminReady()) {
          const initErr = getFirebaseAdminInitError();
          return res.status(503).json({
            success: false,
            error: 'Firebase Admin is not ready',
            detail:
              initErr?.message ||
              'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY',
          });
        }

        const identity = resolveSessionIdentity(req);
        const result = await notificationService.sendTestToUser(identity);
        res.status(200).json({
          success: Boolean(result.success),
          skipped: Boolean(result.skipped),
          reason: result.reason,
          sentCount: result.sentCount ?? 0,
          failedCount: result.failedCount ?? 0,
        });
      } catch (err) {
        return sendError(res, err);
      }
    },
  };
}

/**
 * @param {import('express').Response} res
 * @param {unknown} err
 */
function sendError(res, err) {
  if (err instanceof ValidationError || err instanceof UnauthorizedError || err instanceof NotificationModuleError) {
    return res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
  }
  console.error('[notifications] API error:', err);
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

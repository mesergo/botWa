import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logError } from './errorLogger.js';

/**
 * Best-effort "who was this?" label for the log, even when the request never
 * carried a *valid* identity — the two most common cases being a wrong-password
 * login attempt (no token exists yet) and an expired/tampered token (fails
 * verification, so req.user was never set). Resolves to the user's NAME
 * (not email) wherever a matching User record can be found. Falls back through:
 *   1. req.userId / req.user.id — set by authenticateToken when the token verified fine
 *   2. the token's own `id` claim, decoded WITHOUT verifying the signature
 *      (label only, never trusted for auth — the request was already rejected)
 *   3. req.body.email — e.g. a failed /api/auth/login or /register attempt;
 *      looked up to a name when it matches a real account, otherwise the
 *      email itself is used as a last-resort label
 */
const resolveAttemptedIdentity = async (req) => {
  let userId = req.userId || req.user?.id || null;
  if (!userId) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.decode(token);
        userId = decoded?.id || null;
      } catch (_) { /* not a JWT at all — ignore */ }
    }
  }
  if (userId) {
    try {
      const user = await User.findById(userId).select('name').lean();
      if (user?.name) return user.name;
    } catch (_) { /* invalid id shape — ignore */ }
  }
  if (req.body && typeof req.body.email === 'string' && req.body.email.trim()) {
    const email = req.body.email.trim();
    try {
      const user = await User.findOne({ email }).select('name').lean();
      if (user?.name) return user.name;
    } catch (_) { /* ignore */ }
    return email;
  }
  return null;
};

/**
 * Global Express middleware — registered once, early, before any route is
 * mounted. Captures the outgoing body of every response (by wrapping
 * res.json/res.send on this one request) and, once the response actually
 * finishes, logs an ErrorLog entry for every response with status >= 400.
 *
 * This is what gives "כיסוי מלא" (full coverage) of the ~250+ existing
 * catch-and-respond blocks spread across every controller, without editing
 * any of them: virtually all of them end in `res.status(x>=400).json(...)`,
 * which this middleware observes generically. It intentionally does NOT
 * replace the existing JSON-parse-failure error handler in server.js — that
 * one still runs first and still ends in a res.status().json() call, which
 * still triggers `finish` normally.
 *
 * Two known cases this middleware structurally cannot see (response already
 * sent before the error occurs, or a failure that never produces an HTTP
 * error status at all) are instrumented explicitly at their own source:
 * see whatsappWebhookController.js and utils/whatsappSender.js.
 */
export const responseErrorInterceptor = (req, res, next) => {
  let capturedBody;

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };

  const originalSend = res.send.bind(res);
  res.send = (body) => {
    if (capturedBody === undefined) capturedBody = body;
    return originalSend(body);
  };

  res.on('finish', async () => {
    if (res.statusCode < 400 || res.locals.errorAlreadyLogged) return;

    let message = `HTTP ${res.statusCode}`;
    if (capturedBody && typeof capturedBody === 'object') {
      message = capturedBody.error || capturedBody.message || message;
    } else if (typeof capturedBody === 'string' && capturedBody.trim()) {
      message = capturedBody;
    }

    const clientName = await resolveAttemptedIdentity(req).catch(() => null);

    logError({
      category: res.statusCode === 401 || res.statusCode === 403 ? 'auth' : 'api',
      source: `${req.method} ${req.originalUrl}`,
      message,
      clientId: req.userId || null,
      clientName,
      statusCode: res.statusCode,
      details: { method: req.method, url: req.originalUrl },
    }).catch(() => {});
  });

  next();
};

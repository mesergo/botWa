import jwt from 'jsonwebtoken';
import { logError } from './errorLogger.js';

/**
 * Best-effort "who was this?" label for the log, even when the request never
 * carried a *valid* identity — the two most common cases being a wrong-password
 * login attempt (no token exists yet) and an expired/tampered token (fails
 * verification, so req.user was never set). Falls back through:
 *   1. req.user.email — set by authenticateToken when the token verified fine
 *   2. the token's own `email` claim, decoded WITHOUT verifying the signature
 *      (label only, never trusted for auth — the request was already rejected)
 *   3. req.body.email — e.g. a failed /api/auth/login or /register attempt
 */
const resolveAttemptedIdentity = (req) => {
  if (req.user?.email) return req.user.email;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded?.email) return decoded.email;
    } catch (_) { /* not a JWT at all — ignore */ }
  }
  if (req.body && typeof req.body.email === 'string' && req.body.email.trim()) {
    return req.body.email.trim();
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

  res.on('finish', () => {
    if (res.statusCode < 400 || res.locals.errorAlreadyLogged) return;

    let message = `HTTP ${res.statusCode}`;
    if (capturedBody && typeof capturedBody === 'object') {
      message = capturedBody.error || capturedBody.message || message;
    } else if (typeof capturedBody === 'string' && capturedBody.trim()) {
      message = capturedBody;
    }

    logError({
      category: res.statusCode === 401 || res.statusCode === 403 ? 'auth' : 'api',
      source: `${req.method} ${req.originalUrl}`,
      message,
      clientId: req.userId || null,
      clientName: resolveAttemptedIdentity(req),
      statusCode: res.statusCode,
      details: { method: req.method, url: req.originalUrl },
    }).catch(() => {});
  });

  next();
};

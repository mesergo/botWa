/**
 * Domain errors for the notifications module.
 * These are intended for logging / API responses — never to crash the bot message pipeline.
 */

export class NotificationModuleError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, statusCode?: number, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'NotificationModuleError';
    this.code = options.code || 'NOTIFICATION_ERROR';
    this.statusCode = options.statusCode || 500;
    this.cause = options.cause;
  }
}

export class ValidationError extends NotificationModuleError {
  /**
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, cause: options.cause });
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends NotificationModuleError {
  /**
   * @param {string} [message]
   */
  constructor(message = 'Unauthorized') {
    super(message, { code: 'UNAUTHORIZED', statusCode: 401 });
    this.name = 'UnauthorizedError';
  }
}

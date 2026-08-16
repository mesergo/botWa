/**
 * Express router: /api/push-notifications
 *   GET    /bot-lines
 *   POST   /registrations
 *   DELETE /registrations/:fid
 *   POST   /test
 */

import { Router } from '../../../backend/config/notificationsVendor.js';
import { createDeviceRegistrationController } from './deviceRegistration.controller.js';

/**
 * @param {object} options
 * @param {import('../application/NotificationService.js').NotificationService} options.notificationService
 * @param {import('express').RequestHandler} [options.authenticate]
 * @returns {import('express').Router}
 */
export function createPushNotificationRouter(options) {
  const { notificationService, authenticate } = options;
  if (!notificationService) {
    throw new Error('createPushNotificationRouter requires notificationService');
  }

  const controller = createDeviceRegistrationController(notificationService);
  const router = Router();
  const auth = typeof authenticate === 'function' ? authenticate : (_req, _res, next) => next();

  router.get('/bot-lines', auth, (req, res) => controller.listBotLines(req, res));
  router.post('/registrations', auth, (req, res) => controller.register(req, res));
  router.delete('/registrations/:fid', auth, (req, res) => controller.unregister(req, res));
  router.post('/test', auth, (req, res) => controller.test(req, res));

  return router;
}

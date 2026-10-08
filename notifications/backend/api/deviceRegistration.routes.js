/**
 * Express router: /api/push-notifications
 *   GET    /bot-lines
 *   POST   /registrations
 *   DELETE /registrations/:fid
 *   POST   /test
 *   GET    /email-preference
 *   PUT    /email-preference
 *   POST   /presence
 *   GET    /alert-settings
 *   PUT    /alert-settings
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
  router.get('/email-preference', auth, (req, res) => controller.getEmailPreference(req, res));
  router.put('/email-preference', auth, (req, res) => controller.setEmailPreference(req, res));
  router.post('/presence', auth, (req, res) => controller.presence(req, res));
  router.get('/alert-settings', auth, (req, res) => controller.getAlertSettings(req, res));
  router.put('/alert-settings', auth, (req, res) => controller.setAlertSettings(req, res));

  return router;
}

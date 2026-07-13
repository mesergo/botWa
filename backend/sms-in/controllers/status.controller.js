import * as statusService from '../services/status.service.js';

export async function getStatus(req, res, next) {
  try {
    const status = await statusService.getStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

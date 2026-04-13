
import express from 'express';
import { proxyWebservice } from '../controllers/proxyController.js';

const router = express.Router();

// Note: route named neutrally to avoid UTM/firewall URL-dictionary filters
router.post('/webservice', proxyWebservice);
router.post('/call', proxyWebservice);

export default router;

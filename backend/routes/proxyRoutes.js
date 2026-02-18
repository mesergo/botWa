
import express from 'express';
import { proxyWebservice } from '../controllers/proxyController.js';

const router = express.Router();

router.post('/webservice', proxyWebservice);

export default router;

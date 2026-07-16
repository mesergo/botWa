import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getFields, createField, updateField, deleteField } from '../controllers/contactFieldController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/',     getFields);
router.post('/',    createField);
router.put('/:id',  updateField);
router.delete('/:id', deleteField);

export default router;

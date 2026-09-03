import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import {
  listTables,
  createTable,
  updateTable,
  deleteTable,
  listRows,
  createRow,
  updateRow,
  deleteRow,
  downloadTemplate,
  importRows,
  updateSyncSettings,
  triggerSyncNow,
  getStats,
  listSyncLogs,
  previewSheet,
  importJsonRows,
  updateApiSettings,
  runMongoQuery,
} from './internalDataController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer: store uploaded import files temporarily (same convention as contactRoutes.js)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `internal-data-import-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
  },
});

const router = express.Router();
router.use(authenticateToken, requirePermission('internal_data.view'));

router.get('/stats', getStats);
router.post('/sheets/preview', previewSheet);

router.get('/tables', listTables);
router.post('/tables', createTable);
router.put('/tables/:id', updateTable);
router.delete('/tables/:id', deleteTable);

router.get('/tables/:id/template', downloadTemplate);
router.post('/tables/:id/import', upload.single('file'), importRows);
router.post('/tables/:id/import-data', importJsonRows);

router.put('/tables/:id/sync', updateSyncSettings);
router.post('/tables/:id/sync/run-now', triggerSyncNow);
router.get('/tables/:id/logs', listSyncLogs);

router.put('/tables/:id/api', updateApiSettings);
router.post('/tables/:id/query', runMongoQuery);

router.get('/tables/:id/rows', listRows);
router.post('/tables/:id/rows', createRow);
router.put('/rows/:id', updateRow);
router.delete('/rows/:id', deleteRow);

export default router;

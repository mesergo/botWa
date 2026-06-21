import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload endpoint - requires authentication
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/uploads/${req.file.filename}`;

    console.log(`[Upload] File uploaded successfully | user=${req.user.id} | filename=${req.file.filename} | size=${req.file.size}`);

    res.json({ 
      success: true, 
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Public upload endpoint called by dialog360 when a customer sends media via WhatsApp.
// No auth token — dialog360 cannot send one. Protected by MIME whitelist + size limit.
const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];
const ALLOWED_MIME_EXACT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
  'text/csv'
];

const uploadImageMulter = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype || '';
    const allowed =
      ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p)) ||
      ALLOWED_MIME_EXACT.includes(mime);
    if (allowed) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${mime}`));
    }
  }
});

router.post('/upload-image', uploadImageMulter.single('file'), (req, res) => {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[UploadImage] 📥 POST /api/upload-image — request received`);
  console.log(`[UploadImage]    caller IP   : ${req.ip || req.connection?.remoteAddress || 'unknown'}`);
  console.log(`[UploadImage]    content-type: ${req.headers['content-type'] || 'none'}`);
  console.log(`[UploadImage]    user-agent  : ${req.headers['user-agent'] || 'none'}`);
  try {
    if (!req.file) {
      console.error(`[UploadImage] ❌ No file in request`);
      return res.status(400).json({ success: false, message: 'Missing file' });
    }

    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/uploads/${req.file.filename}`;

    console.log(`[UploadImage] ✅ File saved`);
    console.log(`[UploadImage]    original name: ${req.file.originalname}`);
    console.log(`[UploadImage]    saved as     : ${req.file.filename}`);
    console.log(`[UploadImage]    mime         : ${req.file.mimetype}`);
    console.log(`[UploadImage]    size         : ${(req.file.size / 1024).toFixed(1)} KB`);
    console.log(`[UploadImage]    public URL   : ${url}`);
    console.log(`${'─'.repeat(60)}\n`);

    res.json({
      success: true,
      src: url,
      mime: req.file.mimetype
    });
  } catch (error) {
    console.error(`[UploadImage] ❌ Exception:`, error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

export default router;

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// GET /api/notifications — fetch unread/undismissed notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = String(req.userId);
    const items = await Notification.find({ user_id: userId, dismissed: false })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ notifications: items });
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/dismiss — dismiss a notification
router.patch('/:id/dismiss', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);
    await Notification.updateOne(
      { _id: id, user_id: userId },
      { $set: { dismissed: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /notifications/:id/dismiss error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/dismiss-all — dismiss all pending notifications
router.patch('/dismiss-all', authenticateToken, async (req, res) => {
  try {
    const userId = String(req.userId);
    await Notification.updateMany(
      { user_id: userId, dismissed: false },
      { $set: { dismissed: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /notifications/dismiss-all error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

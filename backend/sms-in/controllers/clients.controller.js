import User from '../../models/User.js';
import BotFlow from '../../models/BotFlow.js';

/**
 * GET /api/sms-in/clients
 * Platform customers (User accounts) for SMS line assignment.
 * Same pool as Admin → ניהול לקוחות.
 */
export async function getClients(req, res) {
  try {
    const users = await User.find({
      role: { $nin: ['rep', 'rep_manager', 'rep_bot'] },
    })
      .select('name email phone role account_type status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const clients = await Promise.all(
      users.map(async (user) => {
        const id = user._id.toString();
        const botCount = await BotFlow.countDocuments({ user_id: id });
        const createdAt = user.createdAt
          ? new Date(user.createdAt).toISOString().split('T')[0]
          : '';

        return {
          id,
          name: user.name || user.email || id,
          contactPerson: user.name || '—',
          phone: user.phone || '—',
          email: user.email || '—',
          notes: [
            user.account_type ? `חשבון: ${user.account_type}` : null,
            user.status ? `סטטוס: ${user.status}` : null,
            `${botCount} בוטים`,
          ]
            .filter(Boolean)
            .join(' · '),
          createdAt,
          botCount,
          accountType: user.account_type || null,
          status: user.status || null,
          role: user.role || null,
        };
      })
    );

    res.json({ clients, source: 'mongodb' });
  } catch (err) {
    console.error('[sms-in] getClients error:', err);
    res.status(500).json({ error: err.message || 'Failed to load clients' });
  }
}

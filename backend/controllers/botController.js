import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import Version from '../models/Version.js';

const ACCOUNTS_CONFIG = {
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30 },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30 }
};

export const createBot = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    const accountType = user.account_type || 'Basic';
    const limits = ACCOUNTS_CONFIG[accountType];

    const currentBotsCount = await BotFlow.countDocuments({ user_id: userId });

    if (currentBotsCount >= limits.maxBots) {
      return res.status(403).json({ 
        error: 'MAX_BOTS_REACHED', 
        message: `הגעת למכסה המקסימלית של ${limits.maxBots} בוטים לחשבון ${accountType}.`,
        price: limits.botPrice
      });
    }

    const publicId = Math.random().toString(36).substring(2, 12);
    const createdAt = new Date().toISOString();
    const bot = await BotFlow.create({
      name: name,
      user_id: userId,
      public_id: publicId,
      created_at: createdAt
    });
    res.json({ id: bot._id.toString(), name, public_id: publicId, created_at: createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getBots = async (req, res) => {
  const userId = req.user.id;
  try {
    const bots = await BotFlow.find({ user_id: userId }).sort({ created_at: -1 });
    res.json(bots.map(b => ({
      id: b._id.toString(),
      name: b.name,
      public_id: b.public_id,
      created_at: b.created_at
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteBot = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    await Widget.deleteMany({ flow_id: id });
    await Version.deleteMany({ flow_id: id });
    await BotFlow.deleteOne({ _id: id, user_id: userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
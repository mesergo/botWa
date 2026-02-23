import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import Version from '../models/Version.js';
import { getUserLimits } from '../utils/limits.js';

const ACCOUNTS_CONFIG = {
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30 },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30 }
};

export const createBot = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    const limits = await getUserLimits(user);
    const accountType = user.account_type || 'Basic';

    // Block expired trial users
    if (limits.trialExpired) {
      return res.status(403).json({
        error: 'TRIAL_EXPIRED',
        message: 'תקופת הניסיון שלך הסתיימה. אנא שדרג את החשבון כדי להמשיך.'
      });
    }

    const currentBotsCount = await BotFlow.countDocuments({ user_id: userId });

    if (currentBotsCount >= limits.maxBots) {
      return res.status(403).json({ 
        error: 'MAX_BOTS_REACHED', 
        message: `הגעת למכסה המקסימלית של ${limits.maxBots} בוטים.`,
        price: limits.botPrice
      });
    }

    const publicId = Math.random().toString(36).substring(2, 12);
    const createdAt = new Date().toISOString();

    // If this is the first bot, set it as default
    const isFirstBot = currentBotsCount === 0;

    const bot = await BotFlow.create({
      name: name,
      user_id: userId,
      public_id: publicId,
      created_at: createdAt,
      is_default: isFirstBot
    });
    res.json({ id: bot._id.toString(), name, public_id: publicId, created_at: createdAt, is_default: isFirstBot });
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
      created_at: b.created_at,
      is_default: b.is_default || false
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteBot = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    // Check if the bot being deleted is the default
    const botToDelete = await BotFlow.findOne({ _id: id, user_id: userId });
    const wasDefault = botToDelete?.is_default || false;

    await Widget.deleteMany({ flow_id: id });
    await Version.deleteMany({ flow_id: id });
    await BotFlow.deleteOne({ _id: id, user_id: userId });

    // If the deleted bot was default, set another bot as default
    if (wasDefault) {
      const remainingBots = await BotFlow.find({ user_id: userId }).sort({ created_at: 1 });
      if (remainingBots.length > 0) {
        remainingBots[0].is_default = true;
        await remainingBots[0].save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const setDefaultBot = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    // Verify bot belongs to user
    const bot = await BotFlow.findOne({ _id: id, user_id: userId });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Remove default from all user's bots
    await BotFlow.updateMany(
      { user_id: userId },
      { is_default: false }
    );

    // Set this bot as default
    bot.is_default = true;
    await bot.save();

    res.json({ success: true, message: 'הבוט הוגדר כברירת מחדל' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
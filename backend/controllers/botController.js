import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import Version from '../models/Version.js';
import { getUserLimits } from '../utils/limits.js';
import fetch from 'node-fetch';
import { getEffectiveUserId } from '../middleware/auth.js';

const ACCOUNTS_CONFIG = {
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30 },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30 }
};

export const createBot = async (req, res) => {
  const { name } = req.body;
  const role = req.user?.role;
  if (role === 'rep' || role === 'rep_bot') {
    return res.status(403).json({ error: 'Access denied. Representatives cannot create bots.' });
  }
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
  const userId = getEffectiveUserId(req);
  try {
    const bots = await BotFlow.find({ user_id: userId }).sort({ created_at: -1 });
    res.json(bots.map(b => ({
      id: b._id.toString(),
      name: b.name,
      public_id: b.public_id,
      created_at: b.created_at,
      is_default: b.is_default || false,
      botParams: b.botParams ? Object.fromEntries(b.botParams) : {}
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteBot = async (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;
  if (role === 'rep' || role === 'rep_bot') {
    return res.status(403).json({ error: 'Access denied. Representatives cannot delete bots.' });
  }
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
  const role = req.user?.role;
  if (role === 'rep' || role === 'rep_bot') {
    return res.status(403).json({ error: 'Access denied. Representatives cannot change default bot.' });
  }
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

/**
 * Send a Facebook connection request email to the admin using Mesergo XML API.
 */
export const connectFacebook = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const bot = await BotFlow.findOne({ _id: id, user_id: userId });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const username = process.env.MESERGO_EMAIL_USERNAME || 'admin@chatgo.live';
    const token = process.env.MESERGO_EMAIL_TOKEN || '1aa14226-ceae-4104-ba86-899eca88631d';
    const fromAddress = process.env.MESERGO_FROM_ADDRESS || 'admin@chatgo.live';
    const toEmail = 'go@mesergo.co.il';
    
    const subject = 'חיבור לפייסבוק';
    const htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;">
      <h2 style="color:#1877F2;">בקשת חיבור לפייסבוק</h2>
      <h3>פרטי משתמש:</h3>
      <ul>
        <li><strong>שם:</strong> ${user.name || 'לא צוין'}</li>
        <li><strong>אימייל:</strong> ${user.email}</li>
      </ul>
      <h3>פרטי בוט:</h3>
      <ul>
        <li><strong>שם הבוט:</strong> ${bot.name}</li>
        <li><strong>מזהה בוט:</strong> ${bot._id}</li>
      </ul>
    </div>`;

    const xmlString = `<InfoMailClient>
<SendEmails>
<User>
<Username>${username}</Username>
<Token>${token}</Token>
</User>
<Message>
<CampaignName>חיבור פייסבוק - ${bot.name}</CampaignName>
<FromAddress>${fromAddress}</FromAddress>
<FromName>Mesergo Bots</FromName>
<Subject><![CDATA[${subject}]]></Subject>
<Body><![CDATA[${htmlBody}]]></Body>
</Message>
<Recipients>
<Email address="${toEmail}" />
</Recipients>
</SendEmails>
</InfoMailClient>`;

    const encodedXml = encodeURIComponent(xmlString);
    const url = `https://capi.mesergo.co.il/mail/api.php?xml=${encodedXml}`;

    const mailRes = await fetch(url, {
      method: 'GET',
      timeout: 30000
    });

    const rawText = await mailRes.text();
    console.log('Mesergo mail status:', mailRes.status, 'response:', rawText);

    // Parse XML response
    const statusMatch = rawText.match(/<Status>(.*?)<\/Status>/);
    const campaignIdMatch = rawText.match(/<CampaignId>(.*?)<\/CampaignId>/);
    
    const status = statusMatch ? statusMatch[1].trim() : null;
    const campaignId = campaignIdMatch ? campaignIdMatch[1].trim() : null;
    
    const isSuccess = status && (
      status.toLowerCase().includes('success') ||
      status.toLowerCase() === 'ok' ||
      mailRes.status === 200
    );

    if (isSuccess || (mailRes.status === 200 && campaignId)) {
      console.log('✅ Email sent successfully, CampaignId:', campaignId);
      res.json({ success: true, campaignId });
    } else {
      console.error('❌ Mesergo mail error:', status || rawText);
      res.status(500).json({ error: 'שגיאה בשליחת הבקשה', details: status || rawText });
    }
  } catch (err) {
    console.error('❌ Exception in connectFacebook:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update bot parameters (values filled in from template form).
 * Body: { params: { variableName: value, ... } }
 */
export const updateBotParams = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { params } = req.body;
  try {
    const bot = await BotFlow.findOne({ _id: id, user_id: userId });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    bot.botParams = params || {};
    await bot.save();
    res.json({ success: true, botParams: Object.fromEntries(bot.botParams) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
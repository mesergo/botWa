import User from '../models/User.js';
import BotSession from '../models/BotSession.js';
import BotFlow from '../models/BotFlow.js';
import AuditLog from '../models/AuditLog.js';
import SystemSetting from '../models/SystemSetting.js';
import { DEFAULT_REMOVAL_CONFIG, getGlobalRemovalConfig } from '../utils/removalConfig.js';
import UserType from '../models/UserType.js';
import Dialog360TemplateSetting from '../models/Dialog360TemplateSetting.js';
import { updatePaymentCountriesOnGateway } from '../utils/whatsappSender.js';
import { normalizeLinkBody, sanitizeNumber, normalizePhone } from './whatsappRegistrationController.js';
  
// Default configuration if DB is empty (used for fallback)
const DEFAULT_ACCOUNTS_CONFIG = {
  Trial: { maxBots: 1, maxVersions: 0, versionPrice: 0, botPrice: 0, canPublish: false, trialDays: 30, maxConnectedNumbers: 1, maxReps: 0, maxActiveContacts: 50 },
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30, canPublish: true, maxConnectedNumbers: 1, maxReps: 1, maxActiveContacts: 200 },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30, canPublish: true, maxConnectedNumbers: 3, maxReps: 3, maxActiveContacts: 500 },
  Pro: { maxBots: 10, maxVersions: 15, versionPrice: 5, botPrice: 30, canPublish: true, maxConnectedNumbers: 5, maxReps: 5, maxActiveContacts: 1000 },
  Unlimited: { maxBots: 999, maxVersions: 999, versionPrice: 0, botPrice: 0, canPublish: true, maxConnectedNumbers: 999, maxReps: 999, maxActiveContacts: 999999 },
  // Global (not per-plan) setting: size of the rolling window used to compute "active contacts".
  activeContactsWindowDays: 60
}; 

export const getSystemSettings = async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ key: 'accounts_config' });
    if (!setting) {
      return res.json(DEFAULT_ACCOUNTS_CONFIG);
    }
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching system settings', error: error.message });
  }
};

export const updateSystemSettings = async (req, res) => {
  const { config } = req.body;
  const adminId = req.userId;
  const adminEmail = req.user?.email;

  try {
    // Upsert the settings
    await SystemSetting.findOneAndUpdate(
      { key: 'accounts_config' },
      { value: config },
      { upsert: true, new: true }
    );

    // Re-evaluate the active-contacts quota flag for every top-level account against its
    // already-cached count. A plan-level maxActiveContacts change here affects everyone on
    // that plan (not just a single user edited via updateUser), so it must be handled here
    // too — otherwise accounts keep showing a stale exceeded/not-exceeded flag until the
    // next scheduled activeContactsTicker.js run (up to 24h later). No BotSession
    // aggregation re-run — the ticker still owns recomputing the actual counts.
    const mergedConfig = { ...DEFAULT_ACCOUNTS_CONFIG, ...config };
    const topLevelUsers = await User.find({ manager_id: null });
    for (const user of topLevelUsers) {
      const accountType = user.account_type || 'Basic';
      const planLimits = mergedConfig[accountType] || mergedConfig['Basic'];
      let freshLimit = planLimits?.maxActiveContacts ?? 0;
      if (user.custom_limits?.max_active_contacts !== null && user.custom_limits?.max_active_contacts !== undefined) {
        freshLimit = user.custom_limits.max_active_contacts;
      }
      const stillExceeded = freshLimit > 0 && (user.active_contacts_count || 0) > freshLimit;
      if (stillExceeded !== (user.active_contacts_quota_exceeded === true)) {
        user.active_contacts_quota_exceeded = stillExceeded;
        if (!stillExceeded) user.active_contacts_last_alert_at = null;
        // eslint-disable-next-line no-await-in-loop
        await user.save();
      }
    }

    // Log the action
    await logAdminAction(adminId, adminEmail, 'UPDATE_SYSTEM_SETTINGS', 'System', 'System', { config });

    res.json({ message: 'System settings updated successfully', config });
  } catch (error) {
    res.status(500).json({ message: 'Error updating system settings', error: error.message });
  }
};

// ── Removal-from-group default config (admin-managed) ────────────────────────
export const getRemovalConfig = async (req, res) => {
  try {
    const config = await getGlobalRemovalConfig();
    res.json({ config, defaults: DEFAULT_REMOVAL_CONFIG });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching removal config', error: error.message });
  }
};

export const updateRemovalConfig = async (req, res) => {
  try {
    const { config } = req.body || {};
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ message: 'Missing config' });
    }
    const cleaned = {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : true,
      keywords_he: Array.isArray(config.keywords_he)
        ? config.keywords_he.map(k => String(k || '').trim()).filter(Boolean)
        : [],
      message_he: typeof config.message_he === 'string' ? config.message_he : '',
      keywords_en: Array.isArray(config.keywords_en)
        ? config.keywords_en.map(k => String(k || '').trim()).filter(Boolean)
        : [],
      message_en: typeof config.message_en === 'string' ? config.message_en : ''
    };
    if (cleaned.keywords_he.length === 0) cleaned.keywords_he = DEFAULT_REMOVAL_CONFIG.keywords_he;
    if (!cleaned.message_he.trim()) cleaned.message_he = DEFAULT_REMOVAL_CONFIG.message_he;
    if (cleaned.keywords_en.length === 0) cleaned.keywords_en = DEFAULT_REMOVAL_CONFIG.keywords_en;
    if (!cleaned.message_en.trim()) cleaned.message_en = DEFAULT_REMOVAL_CONFIG.message_en;

    // Load current config before saving so we can diff it
    const previous = await getGlobalRemovalConfig();

    await SystemSetting.findOneAndUpdate(
      { key: 'removal_config' },
      { value: cleaned, description: 'Global default config for the auto-removal-from-group feature' },
      { upsert: true, new: true }
    );

    // Diff and write audit log entries
    const actorId = req.user?.id;
    const actorEmail = req.user?.email || '';
    const logEntries = buildRemovalConfigDiff(previous, cleaned, actorId, actorEmail);
    if (logEntries.length > 0) {
      await AuditLog.insertMany(logEntries);
    }

    res.json({ message: 'Removal config updated', config: cleaned });
  } catch (error) {
    res.status(500).json({ message: 'Error updating removal config', error: error.message });
  }
};

// GET /api/admin/settings/removal/log?page=1&userId=<userId>
// When `userId` is provided, only returns log entries whose actor was that user
// (i.e. that specific customer's own removal-keyword activity).
export const getRemovalConfigLog = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const filter = { target_type: 'RemovalConfig' };
    if (req.query.userId) filter.actor_id = req.query.userId;
    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);
    res.json({ entries, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching removal config log', error: error.message });
  }
};

// GET /api/admin/users/:userId/dialog360-templates
// Fetch a specific customer's Dialog360 WhatsApp templates (admin viewing on their behalf).
export const getUserDialog360Templates = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let botId = user.dialog360_bot_id;

    // Fallback: if the user has no dialog360_bot_id, use the first bot's endpoint field
    if (!botId) {
      const firstBot = await BotFlow.findOne({
        user_id: userId.toString(),
        endpoint: { $exists: true, $ne: '' }
      }).sort({ created_at: 1 });
      if (firstBot && firstBot.endpoint) {
        const raw = firstBot.endpoint;
        botId = raw.includes('/') ? raw.split('/').pop() : raw;
      }
    }

    if (!botId) {
      return res.status(400).json({
        error: 'Dialog360 Bot ID not configured for this customer.',
        success: false
      });
    }

    const endpoint = `https://app.chatgo.live/api/dialog360/${botId}/message_templates`;
    const crypto = await import('crypto');
    const dToken = crypto.createHash('sha1').update(botId + 'moomoo').digest('hex');

    const response = await fetch(endpoint, { headers: { token: dToken } });
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Dialog360 API returned status ${response.status}: ${errorText}`,
        success: false
      });
    }
    const data = await response.json();
    res.json({ templates: data, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
};

// Normalize a stored Dialog360 template setting: ensure `visibility` is set
// even on legacy records that only had the boolean `showInChat` field.
const normalizeDialog360Setting = (s) => {
  const obj = typeof s.toObject === 'function' ? s.toObject() : { ...s };
  if (!obj.visibility) obj.visibility = obj.showInChat === false ? 'hidden' : 'manager';
  if (obj.showInChat === undefined || obj.showInChat === null) obj.showInChat = obj.visibility !== 'hidden';
  return obj;
};

// GET /api/admin/users/:userId/dialog360-template-settings
// Fetch a specific customer's saved Dialog360 template visibility/default-media settings.
export const getUserDialog360TemplateSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = await Dialog360TemplateSetting.find({ userId });
    res.json({ success: true, settings: settings.map(normalizeDialog360Setting) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/admin/users/:userId/dialog360-template-settings/toggle
// Cycle/set a specific customer's Dialog360 template visibility (hidden/manager/agent).
export const updateUserDialog360TemplateVisibility = async (req, res) => {
  try {
    const { userId } = req.params;
    const { templateName, templateId, language, category, status, visibility } = req.body;
    if (!templateName) return res.status(400).json({ error: 'templateName is required' });

    const effectiveVisibility = ['hidden', 'manager', 'agent'].includes(visibility) ? visibility : 'manager';
    const update = {
      visibility: effectiveVisibility,
      showInChat: effectiveVisibility !== 'hidden',
      templateId,
      language,
      category,
      status,
      userId
    };
    const setting = await Dialog360TemplateSetting.findOneAndUpdate(
      { templateName, userId },
      { $set: update },
      { upsert: true, new: true }
    );
    res.json({ success: true, setting: normalizeDialog360Setting(setting) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/admin/users/:userId/dialog360-template-settings/default-media
// Set (or clear) the default header media for a specific customer's template.
export const updateUserDialog360TemplateDefaultMedia = async (req, res) => {
  try {
    const { userId } = req.params;
    const { templateName, templateId, url, mediaType } = req.body;
    if (!templateName) return res.status(400).json({ error: 'templateName is required' });
    if (url && !['image', 'video', 'document'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be one of: image, video, document' });
    }
    const update = {
      templateId,
      defaultHeaderMediaUrl: url || null,
      defaultHeaderMediaType: url ? mediaType : null,
      userId
    };
    const setting = await Dialog360TemplateSetting.findOneAndUpdate(
      { templateName, userId },
      { $set: update },
      { upsert: true, new: true }
    );
    res.json({ success: true, setting: normalizeDialog360Setting(setting) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/users/:userId/bots
// Lightweight list of a specific customer's bots ({ id, name }), used to power
// the "advanced search" bot picker on the admin panel's per-customer Sessions tab.
export const getUserBots = async (req, res) => {
  try {
    const { userId } = req.params;
    const bots = await BotFlow.find({ user_id: userId.toString() }).select('name').sort({ name: 1 }).lean();
    res.json({ success: true, bots: bots.map(b => ({ id: b._id.toString(), name: b.name })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/users/:userId/connected-numbers
// Read-only list of a specific customer's connected WhatsApp numbers and their status.
export const getUserConnectedNumbers = async (req, res) => {  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('connected_numbers');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const botIds = (user.connected_numbers || []).map(n => n.assigned_bot_id).filter(Boolean);
    const bots = botIds.length ? await BotFlow.find({ _id: { $in: botIds } }).select('name') : [];
    const botNameById = new Map(bots.map(b => [b._id.toString(), b.name]));

    const connected_numbers = (user.connected_numbers || []).map(n => {
      const o = typeof n.toObject === 'function' ? n.toObject() : n;
      const { access_token, pin, token360, ...rest } = o;
      return {
        ...rest,
        provider: o.provider || 'facebook',
        has_access_token: !!access_token,
        has_token360: !!token360,
        link: o.link || '',
        assigned_bot_name: o.assigned_bot_id ? (botNameById.get(o.assigned_bot_id.toString()) || null) : null
      };
    });

    res.json({ success: true, connected_numbers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/admin/connected-numbers
// Global read-only view of EVERY connected WhatsApp number in the system across
// all customers, along with which user owns it and its status (used by the
// admin panel's "מספרים מחוברים" tab).
export const getAllConnectedNumbers = async (req, res) => {
  try {
    const users = await User.find({ 'connected_numbers.0': { $exists: true } })
      .select('name email connected_numbers')
      .lean();

    const allBotIds = [];
    users.forEach(u => (u.connected_numbers || []).forEach(n => {
      if (n.assigned_bot_id) allBotIds.push(n.assigned_bot_id);
    }));
    const bots = allBotIds.length
      ? await BotFlow.find({ _id: { $in: allBotIds } }).select('name').lean()
      : [];
    const botNameById = new Map(bots.map(b => [b._id.toString(), b.name]));

    const connected_numbers = [];
    users.forEach(u => {
      (u.connected_numbers || []).forEach(n => {
        const { access_token, pin, token360, ...rest } = n;
        connected_numbers.push({
          ...rest,
          user_id: u._id.toString(),
          user_name: u.name || '',
          user_email: u.email || '',
          provider: n.provider || 'facebook',
          has_access_token: !!access_token,
          has_token360: !!token360,
          link: n.link || '',
          assigned_bot_name: n.assigned_bot_id ? (botNameById.get(n.assigned_bot_id.toString()) || null) : null
        });
      });
    });

    res.json({ success: true, connected_numbers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
 
// PATCH /api/admin/users/:userId/connected-numbers/:phoneNumberId/payment-countries
// Body: { allowedPaymentCountries }
// Admin-only update of a customer's connected number payment-country prefixes
// (no ownership restriction). Mirrors the self-service endpoint in
// whatsappRegistrationController.js: persists on the connected number and,
// when assigned to a bot, on the BotFlow document + notifies the external
// WhatsApp gateway (skipped silently if the bot has no endpoint yet).
export const updateConnectedNumberPaymentCountries = async (req, res) => {
  try {
    const { userId, phoneNumberId } = req.params;
    const { allowedPaymentCountries } = req.body || {};

    console.log(`[ADMIN-PAYMENT-COUNTRIES] ▶️ START userId=${userId} phoneNumberId=${phoneNumberId} allowedPaymentCountries=${allowedPaymentCountries}`);

    if (!allowedPaymentCountries || !/^[\d|]+$/.test(allowedPaymentCountries)) {
      console.log(`[ADMIN-PAYMENT-COUNTRIES] ❌ invalid_allowed_payment_countries value="${allowedPaymentCountries}"`);
      return res.status(400).json({ error: 'invalid_allowed_payment_countries' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log(`[ADMIN-PAYMENT-COUNTRIES] ❌ User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const entry = (user.connected_numbers || []).find(n => n.phone_number_id === phoneNumberId);
    if (!entry) {
      console.log(`[ADMIN-PAYMENT-COUNTRIES] ❌ connected_number_not_found for phoneNumberId=${phoneNumberId}. Available ids:`, (user.connected_numbers || []).map(n => n.phone_number_id));
      return res.status(404).json({ error: 'connected_number_not_found' });
    }

    console.log(`[ADMIN-PAYMENT-COUNTRIES] ✅ Found connected_number entry. assigned_bot_id=${entry.assigned_bot_id || 'none'} display_phone_number=${entry.display_phone_number}`);

    entry.allowedPaymentCountries = allowedPaymentCountries;
    user.markModified('connected_numbers');
    await user.save();
    console.log(`[ADMIN-PAYMENT-COUNTRIES] 💾 Saved allowedPaymentCountries on User.connected_numbers`);

    let gatewayResult = { success: false, skipped: true };
    if (entry.assigned_bot_id) {
      const bot = await BotFlow.findById(entry.assigned_bot_id);
      if (bot) {
        console.log(`[ADMIN-PAYMENT-COUNTRIES] 🤖 Found bot ${bot._id} (endpoint=${bot.endpoint || 'none'}). Saving on BotFlow and notifying gateway...`);
        bot.allowedPaymentCountries = allowedPaymentCountries;
        await bot.save();
        gatewayResult = await updatePaymentCountriesOnGateway({
          user,
          bot,
          phone: entry.display_phone_number || phoneNumberId,
          allowedPaymentCountries
        });
        console.log(`[ADMIN-PAYMENT-COUNTRIES] 📡 Gateway result:`, gatewayResult);
      } else {
        console.log(`[ADMIN-PAYMENT-COUNTRIES] ⚠️ assigned_bot_id=${entry.assigned_bot_id} set but BotFlow not found`);
      }
    } else {
      console.log(`[ADMIN-PAYMENT-COUNTRIES] ⚠️ No assigned_bot_id on connected_number — skipping BotFlow update + gateway notify`);
    }

    const o = typeof entry.toObject === 'function' ? entry.toObject() : entry;
    const { access_token, pin, token360, ...rest } = o;
    console.log(`[ADMIN-PAYMENT-COUNTRIES] 🏁 DONE success=true gateway.success=${gatewayResult.success} gateway.skipped=${!!gatewayResult.skipped}`);
    res.json({
      success: true,
      connected_number: { ...rest, has_access_token: !!access_token, has_token360: !!token360 },
      gateway: gatewayResult
    });
  } catch (error) {
    console.error('[ADMIN-PAYMENT-COUNTRIES] 💥 EXCEPTION:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/admin/users/:userId/connected-numbers/link-facebook
// Admin-only: link an already-activated Facebook/WhatsApp Cloud API number to a
// SPECIFIC customer's account (no ownership/self-service token required — admin
// acts directly on the target user by id). Reuses the exact same body parsing
// (`normalizeLinkBody`) as the self-service `POST /whatsapp-registration/link-number`
// endpoint, so it accepts either the flat Embedded-Signup shape or the raw
// WhatsApp webhook shape ({ object, access_token, entry: [{ id, changes: [{ value, field }] }] }).
export const linkNumberForCustomer = async (req, res) => {
  const { userId } = req.params;
  const raw = req.body || {};
  const b = normalizeLinkBody(raw);
  const phone_number_id = b.phone_number_id;
  const tag = `[ADMIN-LINK-NUMBER user=${userId} pnid=${phone_number_id}]`;

  console.log(`${tag} ▶️ START`);

  if (!phone_number_id) {
    console.log(`${tag} ❌ missing_phone_number_id`);
    return res.status(400).json({ error: 'missing_phone_number_id' });
  }
  if (!b.access_token) {
    console.log(`${tag} ❌ missing_access_token`);
    return res.status(400).json({ error: 'missing_access_token' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log(`${tag} ❌ User not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);

    if (!existing) {
      const limits = await getUserLimits(user);
      const currentCount = (user.connected_numbers || []).length;
      if (currentCount >= limits.maxConnectedNumbers) {
        console.log(`${tag} ❌ quota_exceeded current=${currentCount} max=${limits.maxConnectedNumbers}`);
        return res.status(403).json({
          error: 'quota_exceeded',
          message: 'המכסה נגמרה. יש ליצור קשר עם המשרד לתשלום להוספת מספר.',
          current: currentCount,
          max: limits.maxConnectedNumbers
        });
      }
    }

    const payload = {
      phone_number_id,
      provider: 'facebook',
      waba_id: b.waba_id || existing?.waba_id || '',
      display_phone_number: normalizePhone(b.display_phone_number ?? existing?.display_phone_number ?? ''),
      verified_name: b.verified_name ?? existing?.verified_name ?? '',
      quality_rating: b.quality_rating ?? existing?.quality_rating ?? '',
      whatsapp_status: b.status ?? existing?.whatsapp_status ?? '',
      access_token: b.access_token,
      registered: typeof b.registered === 'boolean' ? b.registered : (existing?.registered || false),
      pin: (b.pin && /^\d{6}$/.test(b.pin)) ? b.pin : (existing?.pin || ''),
      assigned_bot_id: existing?.assigned_bot_id || null,
      connected_at: existing?.connected_at || new Date(),
      allowedPaymentCountries: existing?.allowedPaymentCountries || '972'
    };

    if (existing) {
      Object.assign(existing, payload);
      user.markModified('connected_numbers');
      console.log(`${tag} 🔄 updated existing connected number entry`);
    } else {
      user.connected_numbers.push(payload);
      console.log(`${tag} ➕ added new connected number entry`);
    }

    await user.save();
    console.log(`${tag} 🏁 DONE success=true total_connected=${user.connected_numbers.length}`);

    return res.json({
      success: true,
      user_id: userId,
      user_status: user.status,
      connected_number: sanitizeNumber(payload),
      total_connected: user.connected_numbers.length
    });
  } catch (err) {
    console.error(`${tag} 💥 EXCEPTION:`, err);
    return res.status(500).json({ error: err.message });
  }
};


// POST /api/admin/users/:userId/connected-numbers/link-dialog360
// Admin-only: link an already-activated Dialog360 WhatsApp number to a SPECIFIC
// customer's account (no ownership/self-service token required — admin acts
// directly on the target user by id). Mirrors the dialog360 branch of the
// self-service `POST /whatsapp-registration/link-number` endpoint (see
// `linkNumber` in whatsappRegistrationController.js).
//
// Body: { token360, link, display_phone_number? }
export const linkDialog360NumberForCustomer = async (req, res) => {
  const { userId } = req.params;
  const raw = req.body || {};
  const { token360, link } = raw;
  const tag = `[ADMIN-LINK-D360 user=${userId} token=${(token360 || '').slice(0, 8)}...]`;

  console.log(`${tag} ▶️ START`);

  if (!token360) {
    console.log(`${tag} ❌ missing_token360`);
    return res.status(400).json({ error: 'missing_token360' });
  }
  if (!link) {
    console.log(`${tag} ❌ missing_link`);
    return res.status(400).json({ error: 'missing_link' });
  }

  // token360 is unique per channel; used as the phone_number_id key
  const phone_number_id = token360;

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log(`${tag} ❌ User not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);

    if (!existing) {
      const limits = await getUserLimits(user);
      const currentCount = (user.connected_numbers || []).length;
      if (currentCount >= limits.maxConnectedNumbers) {
        console.log(`${tag} ❌ quota_exceeded current=${currentCount} max=${limits.maxConnectedNumbers}`);
        return res.status(403).json({
          error: 'quota_exceeded',
          message: 'המכסה נגמרה. יש ליצור קשר עם המשרד לתשלום להוספת מספר.',
          current: currentCount,
          max: limits.maxConnectedNumbers
        });
      }
    }

    const payload = {
      phone_number_id,
      provider: 'dialog360',
      token360,
      link,
      display_phone_number: normalizePhone(raw.display_phone_number ?? existing?.display_phone_number ?? ''),
      verified_name: raw.verified_name ?? existing?.verified_name ?? '',
      waba_id: existing?.waba_id || '',
      quality_rating: existing?.quality_rating || '',
      whatsapp_status: existing?.whatsapp_status || 'CONNECTED',
      access_token: '',
      registered: true,
      pin: '',
      assigned_bot_id: existing?.assigned_bot_id || null,
      connected_at: existing?.connected_at || new Date(),
      allowedPaymentCountries: existing?.allowedPaymentCountries || '972'
    };

    if (existing) {
      Object.assign(existing, payload);
      user.markModified('connected_numbers');
      console.log(`${tag} 🔄 updated existing dialog360 entry`);
    } else {
      user.connected_numbers.push(payload);
      console.log(`${tag} ➕ added new dialog360 entry`);
    }

    await user.save();
    console.log(`${tag} 🏁 DONE success=true total_connected=${user.connected_numbers.length}`);

    return res.json({
      success: true,
      user_id: userId,
      user_status: user.status,
      connected_number: sanitizeNumber(payload),
      total_connected: user.connected_numbers.length
    });
  } catch (err) {
    console.error(`${tag} 💥 EXCEPTION:`, err);
    return res.status(500).json({ error: err.message });
  }
};

// Helper: diff two removal configs and return AuditLog documents to insert
export const buildRemovalConfigDiff = (previous, next, actorId, actorEmail) => {
  const entries = [];

  // Diff Hebrew keywords
  const prevHe = Array.isArray(previous?.keywords_he) ? previous.keywords_he : [];
  const nextHe = Array.isArray(next?.keywords_he) ? next.keywords_he : [];
  const prevHeSet = new Set(prevHe.map(k => k.trim().toLowerCase()));
  const nextHeSet = new Set(nextHe.map(k => k.trim().toLowerCase()));
  for (const kw of nextHe) {
    if (!prevHeSet.has(kw.trim().toLowerCase())) {
      entries.push({ action: 'REMOVAL_KEYWORD_HE_ADDED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: { keyword: kw } });
    }
  }
  for (const kw of prevHe) {
    if (!nextHeSet.has(kw.trim().toLowerCase())) {
      entries.push({ action: 'REMOVAL_KEYWORD_HE_REMOVED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: { keyword: kw } });
    }
  }

  // Diff English keywords
  const prevEn = Array.isArray(previous?.keywords_en) ? previous.keywords_en : [];
  const nextEn = Array.isArray(next?.keywords_en) ? next.keywords_en : [];
  const prevEnSet = new Set(prevEn.map(k => k.trim().toLowerCase()));
  const nextEnSet = new Set(nextEn.map(k => k.trim().toLowerCase()));
  for (const kw of nextEn) {
    if (!prevEnSet.has(kw.trim().toLowerCase())) {
      entries.push({ action: 'REMOVAL_KEYWORD_EN_ADDED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: { keyword: kw } });
    }
  }
  for (const kw of prevEn) {
    if (!nextEnSet.has(kw.trim().toLowerCase())) {
      entries.push({ action: 'REMOVAL_KEYWORD_EN_REMOVED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: { keyword: kw } });
    }
  }

  // Enabled toggle
  if (previous?.enabled !== next?.enabled) {
    entries.push({ action: next?.enabled ? 'REMOVAL_ENABLED' : 'REMOVAL_DISABLED', actor_id: actorId, actor_email: actorEmail, target_type: 'RemovalConfig', details: {} });
  }
  return entries;
};
import jwt from 'jsonwebtoken';
import { SECRET_KEY, resolvePermissions } from '../middleware/auth.js';
import { getUserLimits } from '../utils/limits.js'; // Added limit checker

// Helper to log admin actions
const logAdminAction = async (adminId, adminEmail, action, targetId, targetType, details) => {
  try {
    await AuditLog.create({
      action,
      actor_id: adminId,
      actor_email: adminEmail,
      target_id: targetId,
      target_type: targetType,
      details
    });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
};

// Get system stats for dashboard
export const getSystemStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const totalBots = await BotFlow.countDocuments({});
    
    // New users today, this week, this month
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
    const newUsersWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } });
    const newUsersMonth = await User.countDocuments({ createdAt: { $gte: monthAgo } });
    
    res.json({
      totalUsers,
      totalBots,
      usersGrowth: {
        today: newUsersToday,
        week: newUsersWeek,
        month: newUsersMonth
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all users (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})

      .select('-password')
      .populate('user_type_id', 'name system_role')
      .sort({ createdAt: -1 });

    // Count reps/sub-users linked to each manager in a single aggregation (avoids N+1 queries)
    const repsCountAgg = await User.aggregate([
      { $match: { manager_id: { $ne: null } } },
      { $group: { _id: '$manager_id', count: { $sum: 1 } } }
    ]);
    const repsCountByManagerId = new Map(repsCountAgg.map(r => [String(r._id), r.count]));
    
    // Get additional stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const userId = user._id.toString();
      const botCount = await BotFlow.countDocuments({ user_id: userId }); // Fixed: Use BotFlow, not Session
      const sessionCount = await BotSession.countDocuments({ user_id: userId });
      
      const limits = await getUserLimits(user);
      
      return {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role,
        dialog360_bot_id: user.dialog360_bot_id,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        manager_id: user.manager_id || null,
        allowed_bot_ids: (user.allowed_bot_ids || []).map(id => id.toString()),
        user_type_id: user.user_type_id || null,
        sms_in_enabled: user.sms_in_enabled === true,
        facebook_connect_enabled: user.facebook_connect_enabled === true,
        internal_data_enabled: user.internal_data_enabled === true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        custom_limits: user.custom_limits,
        limits_in_effect: limits,
        active_contacts_count: user.active_contacts_count || 0,
        active_contacts_quota_exceeded: user.active_contacts_quota_exceeded === true,
        reps_count: repsCountByManagerId.get(userId) || 0,
        stats: {
          bots: botCount,
          flows: sessionCount
        }
      };
    }));
    
    res.json({ users: usersWithStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get specific user details (admin only)
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const bots = await BotFlow.find({ user_id: userId }); // Fixed: BotFlow
    const sessionCount = await BotSession.countDocuments({ user_id: userId });
    const limits = await getUserLimits(user);
    const repsCount = await User.countDocuments({ manager_id: userId });
    
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
        dialog360_bot_id: user.dialog360_bot_id,
        manager_id: user.manager_id || null,
        allowed_bot_ids: (user.allowed_bot_ids || []).map(id => id.toString()),
        sms_in_enabled: user.sms_in_enabled === true,
        facebook_connect_enabled: user.facebook_connect_enabled === true,
        internal_data_enabled: user.internal_data_enabled === true,
        tab_overrides: user.tab_overrides || {},
        custom_limits: user.custom_limits,
        limits_in_effect: limits,
        active_contacts_count: user.active_contacts_count || 0,
        active_contacts_quota_exceeded: user.active_contacts_quota_exceeded === true,
        reps_count: repsCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        connected_numbers_count: (user.connected_numbers || []).length,
        stats: {
            bots: bots.length, // Added this line to fix the bug
            flows: sessionCount
        }
      },
      bots
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user details (admin)
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, password, status, account_type, custom_limits, dialog360_bot_id, user_type_id, manager_id, allowed_bot_ids, sms_in_enabled, facebook_connect_enabled, internal_data_enabled, tab_overrides } = req.body;
    
    console.log('[Admin] Updating user:', userId, 'with data:', { ...req.body, password: password ? '***' : undefined });
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update fields 
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (password) user.password = password;
    if (status) user.status = status;
    if (account_type) user.account_type = account_type;
    if (dialog360_bot_id !== undefined) user.dialog360_bot_id = dialog360_bot_id;
    if (manager_id !== undefined) {
      const newManagerId = manager_id || null;
      // Only re-check quota when actually assigning to a *different* manager
      // (re-saving the same manager, or clearing it, should never be blocked).
      if (newManagerId && newManagerId !== user.manager_id) {
        const managerUser = await User.findById(newManagerId);
        if (!managerUser) return res.status(400).json({ error: 'המנהל שנבחר לא נמצא' });
        const managerLimits = await getUserLimits(managerUser);
        const maxReps = managerLimits.maxReps ?? 0;
        const currentRepsCount = await User.countDocuments({ manager_id: newManagerId });
        if (currentRepsCount >= maxReps) {
          return res.status(403).json({
            error: `המנהל הגיע למכסת הנציגים המקסימלית (${maxReps}). לא ניתן להוסיף נציג נוסף.`,
            repsQuotaExceeded: true,
            maxReps,
            currentRepsCount
          });
        }
      }
      user.manager_id = newManagerId;
    }
    if (Array.isArray(allowed_bot_ids)) user.allowed_bot_ids = allowed_bot_ids;
    if (sms_in_enabled !== undefined) user.sms_in_enabled = sms_in_enabled === true;
    if (facebook_connect_enabled !== undefined) user.facebook_connect_enabled = facebook_connect_enabled === true;
    if (internal_data_enabled !== undefined) user.internal_data_enabled = internal_data_enabled === true;

    // Per-customer tab visibility overrides (tri-state: true/false/null). See plan:
    // perCustomerTabManagementOverride. Only whitelisted keys are accepted, each coerced
    // to true/false/null (any other value is treated as null/inherit).
    if (tab_overrides && typeof tab_overrides === 'object') {
      const coerce = (v) => (v === true ? true : v === false ? false : null);
      const allowedKeys = ['bots', 'sessions', 'contacts', 'send_messages', 'sms_in'];
      const merged = { ...(user.tab_overrides || {}) };
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(tab_overrides, key)) {
          merged[key] = coerce(tab_overrides[key]);
        }
      }
      user.tab_overrides = merged;
    }
    
    // Update user type / permissions
    if (user_type_id !== undefined) {
      if (user_type_id) {
        const userType = await UserType.findById(user_type_id);
        if (!userType) return res.status(400).json({ error: 'סוג משתמש לא נמצא' });
        user.user_type_id = user_type_id;
        // Sync the legacy role field from the user type's system_role
        if (userType.system_role) user.role = userType.system_role;
      } else {
        user.user_type_id = null;
      }
    }
    
    // Update custom limits if provided
    if (custom_limits) {
      user.custom_limits = {
        ...user.custom_limits,
        ...custom_limits
      };
    }

    // Re-evaluate the active-contacts quota flag immediately against the already-cached
    // count, whenever the effective limit may have changed (plan change or custom override).
    // This avoids waiting up to 24h for activeContactsTicker.js's next scheduled recheck,
    // without re-running the expensive BotSession aggregation here.
    if (custom_limits || account_type) {
      const freshLimits = await getUserLimits(user);
      const freshLimit = freshLimits.maxActiveContacts ?? 0;
      const stillExceeded = freshLimit > 0 && (user.active_contacts_count || 0) > freshLimit;
      user.active_contacts_quota_exceeded = stillExceeded;
      if (!stillExceeded) user.active_contacts_last_alert_at = null;
    }
    
    await user.save();
    await user.populate('user_type_id', 'name system_role');
    
    console.log('[Admin] User saved successfully. dialog360_bot_id:', user.dialog360_bot_id);
    
    await logAdminAction(req.userId, req.user.email, 'UPDATE_USER', userId, 'User', { 
      name, email, status, account_type, dialog360_bot_id 
    });
    
    // Return full user object with all fields
    const limits = await getUserLimits(user);
    const botCount = await BotFlow.countDocuments({ user_id: userId });
    const sessionCount = await BotSession.countDocuments({ user_id: userId });
    
    res.json({ 
      message: 'User updated successfully', 
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
        dialog360_bot_id: user.dialog360_bot_id,
        user_type_id: user.user_type_id || null,
        manager_id: user.manager_id || null,
        allowed_bot_ids: (user.allowed_bot_ids || []).map(id => id.toString()),
        sms_in_enabled: user.sms_in_enabled === true,
        facebook_connect_enabled: user.facebook_connect_enabled === true,
        internal_data_enabled: user.internal_data_enabled === true,
        tab_overrides: user.tab_overrides || {},
        custom_limits: user.custom_limits,
        limits_in_effect: limits,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        stats: {
          bots: botCount,
          flows: sessionCount
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete user (admin)
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 1. Delete all user's bots
    await BotFlow.deleteMany({ user_id: userId });
    
    // 2. Delete user
    await User.findByIdAndDelete(userId);
    
    await logAdminAction(req.userId, req.user.email, 'DELETE_USER', userId, 'User', { 
      deletedEmail: user.email 
    });
    
    res.json({ success: true, message: 'User and all associated data deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Impersonate user - generate token as if logging in as that user
export const impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate a token for the target user with impersonation flag
    const impersonationToken = jwt.sign(
      { 
        id: userId, 
        email: user.email,
        role: user.role,
        manager_id: user.manager_id || null,
        user_type_id: user.user_type_id || null,
        impersonatedBy: req.userId, // Track who is impersonating
        isImpersonating: true
      }, 
      SECRET_KEY,
      { expiresIn: '2h' } // Impersonation tokens expire after 2 hours
    );

    const permissions = await resolvePermissions(user);
    
    await logAdminAction(req.userId, req.user.email, 'IMPERSONATE', userId, 'User', { 
      targetEmail: user.email 
    });
    
    res.json({
      token: impersonationToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        user_type_id: user.user_type_id || null,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        api_token: user.token,
        permissions,
        isImpersonating: true,
        impersonatedBy: req.userId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Stop impersonation and return to admin account
export const stopImpersonation = async (req, res) => {
  try {
    const adminUserId = req.user.impersonatedBy;
    
    if (!adminUserId) {
      return res.status(400).json({ error: 'Not currently impersonating' });
    }
    
    const adminUser = await User.findById(adminUserId);
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    // Generate a fresh admin token
    const adminToken = jwt.sign(
      {
        id: adminUserId,
        email: adminUser.email,
        role: adminUser.role,
        manager_id: adminUser.manager_id || null,
        user_type_id: adminUser.user_type_id || null
      },
      SECRET_KEY
    );

    const adminPermissions = await resolvePermissions(adminUser);
    
    res.json({
      token: adminToken,
      user: {
        id: adminUserId,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        user_type_id: adminUser.user_type_id || null,
        public_id: adminUser.public_id,
        account_type: adminUser.account_type,
        status: adminUser.status,
        api_token: adminUser.token,
        permissions: adminPermissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user role (promote to admin or demote to user)
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.role = role;
    await user.save();
    
    await logAdminAction(req.userId, req.user.email, 'CHANGE_ROLE', userId, 'User', { newRole: role });
    
    res.json({
      message: `User role updated to ${role}`,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new user directly from the admin panel
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, account_type, user_type_id, manager_id, allowed_bot_ids, allowDuplicateEmail } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'שם ואימייל נדרשים' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingAccounts = await User.find({ email: normalizedEmail }).select('name account_type role createdAt');
    if (existingAccounts.length > 0 && allowDuplicateEmail !== true) {
      return res.status(409).json({
        emailExists: true,
        count: existingAccounts.length,
        accounts: existingAccounts.map(u => ({
          id: u._id.toString(),
          name: u.name,
          account_type: u.account_type || 'Basic',
          role: u.role || 'user',
          created_at: u.createdAt
        }))
      });
    }

    // Determine role from user_type if provided
    let role = 'user';
    let resolvedUserTypeId = null;
    if (user_type_id) {
      const userType = await UserType.findById(user_type_id);
      if (!userType) return res.status(400).json({ error: 'סוג משתמש לא קיים' });
      role = userType.system_role || 'user';
      resolvedUserTypeId = userType._id;
    }

    // If this new user is being assigned as a rep under a manager, enforce that
    // manager's rep quota (plan limit, or custom override) before creating it.
    if (manager_id) {
      const managerUser = await User.findById(manager_id);
      if (!managerUser) return res.status(400).json({ error: 'המנהל שנבחר לא נמצא' });
      const managerLimits = await getUserLimits(managerUser);
      const maxReps = managerLimits.maxReps ?? 0;
      const currentRepsCount = await User.countDocuments({ manager_id });
      if (currentRepsCount >= maxReps) {
        return res.status(403).json({
          error: `המנהל הגיע למכסת הנציגים המקסימלית (${maxReps}). לא ניתן להוסיף נציג נוסף.`,
          repsQuotaExceeded: true,
          maxReps,
          currentRepsCount
        });
      }
    }

    const publicId = Math.random().toString(36).substring(2, 15);
    const trialExpiresAt = new Date();
    trialExpiresAt.setMonth(trialExpiresAt.getMonth() + 1);

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      phone: phone || '',
      password: password || null,
      role,
      public_id: publicId,
      account_type: account_type || 'Trial',
      status: 'active',
      trial_expires_at: trialExpiresAt,
      user_type_id: resolvedUserTypeId,
      manager_id: manager_id || null,
      allowed_bot_ids: Array.isArray(allowed_bot_ids) ? allowed_bot_ids : []
    });

    await logAdminAction(req.userId, req.user.email, 'CREATE_USER', user._id.toString(), 'User', {
      createdEmail: email, role, user_type_id: resolvedUserTypeId
    });

    res.status(201).json({
      message: 'משתמש נוצר בהצלחה',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        public_id: user.public_id,
        account_type: user.account_type,
        status: user.status,
        user_type_id: resolvedUserTypeId,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const previewRestoreConversations = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('phone connected_numbers').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { previewLegacyCollections } = await import('../utils/legacyConversationRestore.js');
    const preview = await previewLegacyCollections(user);
    res.json({ success: true, ...preview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const restoreConversations = async (req, res) => {
  try {
    req.setTimeout?.(10 * 60 * 1000);
    const { untilDate, months, collection } = req.body || {};
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { restoreLegacyConversations } = await import('../utils/legacyConversationRestore.js');
    const result = await restoreLegacyConversations({
      user,
      untilDate,
      months,
      collectionName: collection || ''
    });

    await logAdminAction(req.userId, req.user?.email, 'RESTORE_CONVERSATIONS', req.params.userId, 'User', result);
    res.json({ success: true, ...result });
  } catch (err) {
    const status = err.status || (err.message === 'invalid_until_date' ? 400 : 500);
    const messages = {
      legacy_db_unavailable: 'אין חיבור למסד הנתונים הישן של השיחות',
      legacy_collection_not_found: 'לא נמצאה טבלת היסטוריה (fbiz) למספר של הלקוח',
      invalid_until_date: 'תאריך סיום לא תקין'
    };
    res.status(status).json({ error: messages[err.message] || err.message });
  }
};

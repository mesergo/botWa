import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import Version from '../models/Version.js';
import { getUserLimits } from '../utils/limits.js';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { getEffectiveUserId, SECRET_KEY } from '../middleware/auth.js';

const ACCOUNTS_CONFIG = {
  Basic: { maxBots: 3, maxVersions: 5, versionPrice: 5, botPrice: 30 },
  Premium: { maxBots: 6, maxVersions: 10, versionPrice: 5, botPrice: 30 }
};

export const createBot = async (req, res) => {
  const { name } = req.body;
  const role = req.user?.role;
  if (role === 'rep' || role === 'rep_manager') {
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
    const [bots, user] = await Promise.all([
      BotFlow.find({ user_id: userId }).sort({ created_at: -1 }),
      User.findById(userId).select('connected_numbers')
    ]);
    const connected = (user && user.connected_numbers) || [];
    res.json(bots.map(b => {
      let phone = b.display_phone_number || '';
      if (!phone) {
        const match = connected.find(c => c.assigned_bot_id && String(c.assigned_bot_id) === String(b._id));
        if (match) phone = match.display_phone_number || '';
      }
      return {
        id: b._id.toString(),
        name: b.name,
        public_id: b.public_id,
        created_at: b.created_at,
        is_default: b.is_default || false,
        display_phone_number: phone,
        botParams: b.botParams ? Object.fromEntries(b.botParams) : {}
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteBot = async (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;
  if (role === 'rep' || role === 'rep_manager') {
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
  if (role === 'rep' || role === 'rep_manager') {
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
 * Facebction: previously sent an email via Mesergo XML API.
 * The flow has been moved to the client (popup OAuth login). This endpoint
 * is kept as a no-op for backward compatibility.
 */
export const connectFacebook = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const bot = await BotFlow.findOne({ _id: id, user_id: userId });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // ──────────────────────────────────────────────────────────────
    // ⛔ קוד שליחת המייל הושבת — תהליך החיבור עבר לחלונית פייסבוק בצד הלקוח.
    // ──────────────────────────────────────────────────────────────
    /*
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
    */

    // החיבור מתבצע מצד הלקוח דרך OAuth של פייסבוק בחלונית קופצת.
    res.json({ success: true, mode: 'client-popup' });
  } catch (err) {
    console.error('❌ Exception in connectFacebook:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Receive the result of Meta's Embedded Signup popup from the browser.
 *
 * Expected body: { code, waba_id, phone_number_id, client_id?, currentStep?, action?, error_message? }
 *
 * Steps:
 *  1) Exchange the short-lived authorization `code` for a long-lived access token
 *     via GET https://graph.facebook.com/{GRAPH_VERSION}/oauth/access_token
 *  2) Query GET /{waba_id}/phone_numbers to retrieve display_phone_number / verified_name / quality_rating
 *  3) Persist everything on the BotFlow document
 *
 * Verbose logs are emitted at every step (visible via `pm2 logs flowbotbackend`).
 */
export const facebookCallback = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const {
    code,
    waba_id,
    phone_number_id,
    client_id,
    currentStep,
    action,
    error_message
  } = req.body || {};

  const tag = `[FB-Signup bot=${id} user=${userId}]`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${tag} 📥 Received Embedded Signup payload from frontend`);
  console.log(`${tag} currentStep=${currentStep} action=${action}`);
  console.log(`${tag} waba_id=${waba_id} phone_number_id=${phone_number_id} client_id=${client_id}`);
  console.log(`${tag} code=${code ? code.substring(0, 12) + '…(' + code.length + ' chars)' : 'MISSING'}`);
  if (error_message) console.log(`${tag} ⚠️  error_message from FB: ${error_message}`);

  try {
    if (action && action !== 'completed') {
      console.log(`${tag} ⏭  action='${action}' — not completed, nothing to persist.`);
      return res.json({ success: false, skipped: true, reason: `action=${action}` });
    }
    if (!code) {
      console.log(`${tag} ❌ Missing authorization code in payload`);
      return res.status(400).json({ error: 'missing_code' });
    }

    const bot = await BotFlow.findOne({ _id: id, user_id: userId });
    if (!bot) {
      console.log(`${tag} ❌ Bot not found for this user`);
      return res.status(404).json({ error: 'Bot not found' });
    }

    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;
    const graphVersion = process.env.FB_GRAPH_VERSION || 'v20.0';
    if (!appId || !appSecret) {
      console.log(`${tag} ❌ FB_APP_ID / FB_APP_SECRET env vars are not set on the server`);
      return res.status(500).json({ error: 'server_not_configured', details: 'FB_APP_ID / FB_APP_SECRET missing' });
    }

    // ── Step 1: Exchange code → long-lived access token ──
    const tokenUrl =
      `https://graph.facebook.com/${graphVersion}/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(code)}`;
    console.log(`${tag} 🔁 Step 1: exchange code → access_token`);
    console.log(`${tag}    appId         = ${appId}`);
    console.log(`${tag}    graphVersion  = ${graphVersion}`);
    console.log(`${tag}    URL           = ${tokenUrl.replace(appSecret, '***APP_SECRET***').replace(code, '***CODE***')}`);

    const t1 = Date.now();
    const tokenRes = await fetch(tokenUrl, { method: 'GET', timeout: 30000 });
    const tokenText = await tokenRes.text();
    console.log(`${tag} ⬅️  oauth/access_token HTTP ${tokenRes.status} in ${Date.now() - t1}ms`);
    console.log(`${tag}    raw body: ${tokenText.replace(/("access_token"\s*:\s*")[^"]+/, '$1***')}`);

    let tokenJson = {};
    try { tokenJson = JSON.parse(tokenText); } catch (_) {}
    const accessToken = tokenJson.access_token;
    if (!tokenRes.ok || !accessToken) {
      console.log(`${tag} ❌ Token exchange failed`);
      return res.status(502).json({ error: 'token_exchange_failed', details: tokenJson });
    }
    console.log(`${tag} ✅ Got access_token (${accessToken.length} chars, type=${tokenJson.token_type}, expires_in=${tokenJson.expires_in})`);

    // ── Step 2: Fetch phone_numbers under the WABA ──
    // Docs: GET /{WABA_ID}/phone_numbers
    //       ?fields=id,verified_name,display_phone_number,quality_rating,status,
    //               code_verification_status,name_status,messaging_limit_tier
    //       &access_token={SYSTEM_USER_ACCESS_TOKEN}
    let phoneInfo = null;
    let allPhones = [];
    if (waba_id) {
      const phoneFields = [
        'id',
        'verified_name',
        'display_phone_number',
        'quality_rating',
        'status',
        'code_verification_status',
        'name_status',
        'messaging_limit_tier'
      ].join(',');
      const phonesUrl =
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(waba_id)}/phone_numbers` +
        `?fields=${encodeURIComponent(phoneFields)}` +
        `&access_token=${encodeURIComponent(accessToken)}`;

      console.log(`${tag} 🔁 Step 2: GET /{waba_id}/phone_numbers`);
      console.log(`${tag}    waba_id       = ${waba_id}`);
      console.log(`${tag}    graphVersion  = ${graphVersion}`);
      console.log(`${tag}    fields        = ${phoneFields}`);
      console.log(`${tag}    URL           = ${phonesUrl.replace(accessToken, '***ACCESS_TOKEN***')}`);

      const t0 = Date.now();
      try {
        const phonesRes = await fetch(phonesUrl, { method: 'GET', timeout: 30000 });
        const phonesText = await phonesRes.text();
        const dt = Date.now() - t0;
        console.log(`${tag} ⬅️  phone_numbers HTTP ${phonesRes.status} in ${dt}ms`);
        console.log(`${tag}    raw body: ${phonesText}`);

        let phonesJson = {};
        try { phonesJson = JSON.parse(phonesText); }
        catch (parseErr) {
          console.log(`${tag} ⚠️  Failed to parse phone_numbers response as JSON: ${parseErr.message}`);
        }

        if (!phonesRes.ok || phonesJson.error) {
          console.log(`${tag} ❌ phone_numbers returned an error: ${JSON.stringify(phonesJson.error || phonesJson)}`);
        }

        allPhones = Array.isArray(phonesJson.data) ? phonesJson.data : [];
        console.log(`${tag}    parsed phones count = ${allPhones.length}`);
        allPhones.forEach((p, idx) => {
          console.log(
            `${tag}    [#${idx}] id=${p.id} display=${p.display_phone_number} ` +
            `verified_name=${p.verified_name} quality=${p.quality_rating} status=${p.status} ` +
            `code_verification=${p.code_verification_status} name_status=${p.name_status} ` +
            `messaging_limit_tier=${p.messaging_limit_tier}`
          );
        });

        phoneInfo = (phone_number_id && allPhones.find(p => p.id === phone_number_id)) || allPhones[0] || null;
        if (phoneInfo) {
          console.log(`${tag} ✅ Selected phone: id=${phoneInfo.id} display=${phoneInfo.display_phone_number} (matched_by_request_id=${phoneInfo.id === phone_number_id})`);
        } else {
          console.log(`${tag} ⚠️  No phone numbers returned for this WABA`);
        }
      } catch (e) {
        console.log(`${tag} ⚠️  phone_numbers fetch threw after ${Date.now() - t0}ms: ${e.message}`);
      }
    } else {
      console.log(`${tag} ⚠️  No waba_id in payload — skipping phone_numbers fetch`);
    }

    // ── Step 3: Persist to BotFlow ──
    console.log(`${tag} 💾 Step 3: persisting to BotFlow document`);
    bot.waba_id = waba_id || bot.waba_id;
    bot.phone_number_id = phone_number_id || (phoneInfo && phoneInfo.id) || bot.phone_number_id;
    bot.whatsapp_access_token = accessToken;
    bot.whatsapp_connected_at = new Date();
    bot.whatsapp_all_phones = allPhones;
    if (phoneInfo) {
      bot.display_phone_number = phoneInfo.display_phone_number || '';
      bot.whatsapp_verified_name = phoneInfo.verified_name || '';
      bot.whatsapp_quality_rating = phoneInfo.quality_rating || '';
      bot.whatsapp_status = phoneInfo.status || '';
      bot.whatsapp_code_verification_status = phoneInfo.code_verification_status || '';
      bot.whatsapp_name_status = phoneInfo.name_status || '';
      bot.whatsapp_messaging_limit_tier = phoneInfo.messaging_limit_tier || '';
    }
    await bot.save();
    console.log(`${tag} ✅ Saved. waba_id=${bot.waba_id} phone_number_id=${bot.phone_number_id} display=${bot.display_phone_number}`);
    console.log(`${tag}    verified_name=${bot.whatsapp_verified_name} quality=${bot.whatsapp_quality_rating} status=${bot.whatsapp_status}`);
    console.log(`${tag}    code_verification=${bot.whatsapp_code_verification_status} name_status=${bot.whatsapp_name_status} messaging_limit_tier=${bot.whatsapp_messaging_limit_tier}`);

    // ── Step 4: Auto-register / activate the phone number on the Cloud API ──
    let registerResult = null;
    if (bot.phone_number_id) {
      registerResult = await registerWhatsappNumber({
        phoneNumberId: bot.phone_number_id,
        accessToken,
        graphVersion,
        existingPin: bot.whatsapp_two_factor_pin,
        tag
      });
      bot.whatsapp_two_factor_pin = registerResult.pin;
      bot.whatsapp_registered = !!registerResult.success;
      bot.whatsapp_register_response = registerResult.responseBody;
      await bot.save();
    } else {
      console.log(`${tag} ⚠️  Step 4 skipped — no phone_number_id available`);
    }
    console.log(`${'='.repeat(80)}\n`);

    return res.json({
      success: true,
      bot_id: bot._id.toString(),
      waba_id: bot.waba_id,
      phone_number_id: bot.phone_number_id,
      display_phone_number: bot.display_phone_number,
      verified_name: bot.whatsapp_verified_name,
      quality_rating: bot.whatsapp_quality_rating,
      status: bot.whatsapp_status,
      code_verification_status: bot.whatsapp_code_verification_status,
      name_status: bot.whatsapp_name_status,
      messaging_limit_tier: bot.whatsapp_messaging_limit_tier,
      token_type: tokenJson.token_type,
      expires_in: tokenJson.expires_in,
      phones_count: allPhones.length,
      phones: allPhones,
      registered: !!(registerResult && registerResult.success),
      register_response: registerResult ? registerResult.responseBody : null
    });
  } catch (err) {
    console.error(`${tag} ❌ Exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Helper: register / activate a WhatsApp phone number on the Cloud API.
 *   POST https://graph.facebook.com/{ver}/{phone_number_id}/register
 *   body: { messaging_product: "whatsapp", pin: "<6-digit>" }
 *
 * Returns { success, pin, status, responseBody }
 */
async function registerWhatsappNumber({ phoneNumberId, accessToken, graphVersion, existingPin, tag }) {
  const pin = existingPin && /^\d{6}$/.test(existingPin)
    ? existingPin
    : String(Math.floor(100000 + Math.random() * 900000));

  const url = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/register`;
  console.log(`${tag} 🔁 Step 4: POST /${phoneNumberId}/register  (auto-activate phone number)`);
  console.log(`${tag}    URL = ${url}`);
  console.log(`${tag}    pin = ${pin} (reused=${existingPin === pin})`);

  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
      timeout: 30000
    });
    const text = await r.text();
    const dt = Date.now() - t0;
    console.log(`${tag} ⬅️  register HTTP ${r.status} in ${dt}ms`);
    console.log(`${tag}    raw body: ${text}`);
    let body = {};
    try { body = JSON.parse(text); } catch (_) { body = { raw: text }; }
    const ok = r.ok && (body.success === true || body.success === 'true');
    if (ok) {
      console.log(`${tag} ✅ Phone number registered/activated successfully`);
    } else {
      console.log(`${tag} ❌ Phone number registration failed: ${JSON.stringify(body.error || body)}`);
    }
    return { success: ok, pin, status: r.status, responseBody: body };
  } catch (e) {
    console.log(`${tag} ❌ register threw after ${Date.now() - t0}ms: ${e.message}`);
    return { success: false, pin, status: 0, responseBody: { error: e.message } };
  }
}

/**
 * Ingest a raw Meta phone-number JSON object directly (skipping OAuth step 1).
 * Persists the fields to BotFlow (step 2) and triggers /register with PIN (step 3).
 *
 * Endpoint: POST /api/bots/:id/facebook-ingest
 *
 * Expected body (Meta raw JSON, with any of these key spellings accepted):
 *   {
 *     "id" | "phone_number_id":       "403206936201771",
 *     "wabaId" | "waba_id":           "403059862884906",
 *     "wabaName":                     "Ohad's Bots",
 *     "verified_name":                "Ohad's Bots",
 *     "display_phone_number":         "+972 73-332-8792",
 *     "quality_rating":               "UNKNOWN",
 *     "status":                       "PENDING",
 *     "code_verification_status":     "EXPIRED",
 *     "name_status":                  "DECLINED",
 *     "access_token":                 "<optional — overrides stored / env token>",
 *     "pin":                          "<optional 6-digit — otherwise reused/generated>"
 *   }
 *
 * Access token resolution order:
 *   1) body.access_token
 *   2) bot.whatsapp_access_token (saved from a previous Embedded Signup)
 *   3) process.env.META_SYSTEM_USER_TOKEN
 */
export const facebookIngest = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const body = req.body || {};

  const phone_number_id = body.phone_number_id || body.id;
  const waba_id = body.waba_id || body.wabaId;
  const accessToken =
    body.access_token ||
    body.accessToken ||
    null; // may be replaced from bot/env below

  const tag = `[FB-Ingest bot=${id} user=${userId}]`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${tag} 📥 Manual Meta JSON ingest`);
  console.log(`${tag} phone_number_id=${phone_number_id} waba_id=${waba_id}`);

  try {
    if (!phone_number_id) {
      return res.status(400).json({ error: 'missing_phone_number_id', hint: 'Send "id" or "phone_number_id".' });
    }

    const isObjectId = /^[a-f0-9]{24}$/i.test(id);
    const bot = await BotFlow.findOne({
      user_id: userId,
      $or: [
        ...(isObjectId ? [{ _id: id }] : []),
        { public_id: id }
      ]
    });
    if (!bot) {
      console.log(`${tag} ❌ Bot not found for this user (looked up by _id and public_id)`);
      return res.status(404).json({ error: 'Bot not found' });
    }

    const graphVersion = process.env.FB_GRAPH_VERSION || 'v20.0';
    const finalAccessToken =
      accessToken ||
      bot.whatsapp_access_token ||
      process.env.META_SYSTEM_USER_TOKEN ||
      '';

    if (!finalAccessToken) {
      console.log(`${tag} ❌ No access token available (body / bot / env)`);
      return res.status(400).json({
        error: 'missing_access_token',
        hint: 'Provide "access_token" in the body, or set META_SYSTEM_USER_TOKEN env, or first complete Embedded Signup.'
      });
    }

    // ── Step 2: persist the Meta JSON to BotFlow ──
    console.log(`${tag} 💾 Step 2: persisting Meta JSON to BotFlow`);
    bot.phone_number_id = phone_number_id;
    if (waba_id) bot.waba_id = waba_id;
    if (accessToken) bot.whatsapp_access_token = accessToken;
    if (body.display_phone_number !== undefined) bot.display_phone_number = body.display_phone_number || '';
    if (body.verified_name !== undefined) bot.whatsapp_verified_name = body.verified_name || '';
    if (body.quality_rating !== undefined) bot.whatsapp_quality_rating = body.quality_rating || '';
    if (body.status !== undefined) bot.whatsapp_status = body.status || '';
    if (body.code_verification_status !== undefined) bot.whatsapp_code_verification_status = body.code_verification_status || '';
    if (body.name_status !== undefined) bot.whatsapp_name_status = body.name_status || '';
    if (body.messaging_limit_tier !== undefined) bot.whatsapp_messaging_limit_tier = body.messaging_limit_tier || '';
    bot.whatsapp_connected_at = new Date();
    await bot.save();
    console.log(`${tag} ✅ Saved. waba_id=${bot.waba_id} phone_number_id=${bot.phone_number_id} display=${bot.display_phone_number} status=${bot.whatsapp_status}`);

    // ── Step 3: /register with 6-digit PIN ──
    const registerResult = await registerWhatsappNumber({
      phoneNumberId: bot.phone_number_id,
      accessToken: finalAccessToken,
      graphVersion,
      existingPin: (body.pin && /^\d{6}$/.test(body.pin)) ? body.pin : bot.whatsapp_two_factor_pin,
      tag
    });
    bot.whatsapp_two_factor_pin = registerResult.pin;
    bot.whatsapp_registered = !!registerResult.success;
    bot.whatsapp_register_response = registerResult.responseBody;
    if (registerResult.success) bot.whatsapp_status = 'CONNECTED';
    await bot.save();
    console.log(`${'='.repeat(80)}\n`);

    return res.json({
      success: true,
      bot_id: bot._id.toString(),
      waba_id: bot.waba_id,
      phone_number_id: bot.phone_number_id,
      display_phone_number: bot.display_phone_number,
      verified_name: bot.whatsapp_verified_name,
      status: bot.whatsapp_status,
      registered: !!registerResult.success,
      pin: registerResult.pin,
      register_response: registerResult.responseBody
    });
  } catch (err) {
    console.error(`${tag} ❌ Exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Issue a short-lived signed state token used as the OAuth `state` parameter
 * for the Embedded Signup redirect flow. Embeds { botId, userId } so the
 * unauthenticated redirect handler can identify the bot to update.
 *
 * GET /api/bots/:id/facebook-redirect-state  (auth required)
 */
export const issueFacebookState = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const bot = await BotFlow.findOne({ _id: id, user_id: userId });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    const state = jwt.sign({ botId: id, userId, kind: 'fb-signup' }, SECRET_KEY, { expiresIn: '20m' });
    console.log(`[FB-Signup] 🎟  Issued state token for bot=${id} user=${userId} (exp=20m)`);
    res.json({ success: true, state });
  } catch (err) {
    console.error('[FB-Signup] ❌ Failed to issue state:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Receive Meta's OAuth redirect after Embedded Signup completes.
 * Public endpoint (no auth header — auth is carried in the signed `state`).
 *
 * GET /api/bots/facebook-redirect?code=...&state=...
 *
 * Runs the full pipeline: verify state → exchange code → fetch phone_numbers
 * → register/activate the number → persist → return a self-closing HTML page.
 */
export const facebookRedirect = async (req, res) => {
  const { code, state, error: fbErr, error_description, error_reason } = req.query;
  const tag = `[FB-Redirect]`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${tag} 📥 Received GET /facebook-redirect`);
  console.log(`${tag}    code=${code ? code.substring(0, 12) + '…(' + code.length + ')' : 'MISSING'}`);
  console.log(`${tag}    state=${state ? state.substring(0, 20) + '…' : 'MISSING'}`);
  if (fbErr) console.log(`${tag} ⚠️  FB error=${fbErr} reason=${error_reason} desc=${error_description}`);

  const renderClose = (title, message, ok, details = {}) => {
    const color = ok ? '#10b981' : '#ef4444';
    const payload = JSON.stringify({ event: 'fb-redirect-done', ok: !!ok, ...details });
    console.log(`${tag} 🏁 Final response → HTML close page; postMessage payload = ${payload}`);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,Segoe UI,Arial;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#fff;border-radius:24px;padding:40px;box-shadow:0 10px 30px rgba(0,0,0,.08);max-width:420px;text-align:center}
h1{color:${color};margin:0 0 12px;font-size:22px}p{color:#64748b;font-size:14px;line-height:1.6;margin:0 0 20px}
button{background:#2563eb;color:#fff;border:0;padding:12px 28px;border-radius:14px;font-weight:700;cursor:pointer}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p><button onclick="window.close()">סגור חלון</button></div>
<script>try{if(window.opener){window.opener.postMessage(${payload},'*');}setTimeout(()=>window.close(),2500);}catch(e){}</script>
</body></html>`);
  };

  try {
    if (!state) { console.log(`${tag} ❌ Missing state`); return renderClose('שגיאה', 'חסר state בכתובת ההפניה.', false); }
    let decoded;
    try { decoded = jwt.verify(state, SECRET_KEY); }
    catch (e) { console.log(`${tag} ❌ state verify failed: ${e.message}`); return renderClose('שגיאה', 'state לא תקין או פג תוקף.', false); }
    if (decoded.kind !== 'fb-signup' || !decoded.botId || !decoded.userId) {
      console.log(`${tag} ❌ state payload invalid: ${JSON.stringify(decoded)}`);
      return renderClose('שגיאה', 'state אינו מתאים לתהליך זה.', false);
    }
    console.log(`${tag} ✅ state verified: botId=${decoded.botId} userId=${decoded.userId}`);

    if (fbErr || !code) {
      console.log(`${tag} ❌ FB returned error or no code`);
      return renderClose('הרישום בוטל', error_description || 'לא התקבל קוד אישור מפייסבוק.', false);
    }

    const bot = await BotFlow.findOne({ _id: decoded.botId, user_id: decoded.userId });
    if (!bot) { console.log(`${tag} ❌ bot not found`); return renderClose('שגיאה', 'הבוט לא נמצא.', false); }

    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;
    const graphVersion = process.env.FB_GRAPH_VERSION || 'v20.0';
    if (!appId || !appSecret) {
      console.log(`${tag} ❌ FB_APP_ID / FB_APP_SECRET missing`);
      return renderClose('שגיאת הגדרה', 'משתני סביבה של פייסבוק לא מוגדרים בשרת.', false);
    }
    const redirectUri = `${req.protocol}://${req.get('host')}/api/bots/facebook-redirect`;
    const t2 = `[FB-Redirect bot=${decoded.botId} user=${decoded.userId}]`;

    // Step 1: code → token
    const tokenUrl =
      `https://graph.facebook.com/${graphVersion}/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`;
    console.log(`${t2} 🔁 Step 1: exchange code → access_token`);
    console.log(`${t2}    redirect_uri = ${redirectUri}`);
    console.log(`${t2}    URL = ${tokenUrl.replace(appSecret, '***APP_SECRET***').replace(code, '***CODE***')}`);
    const t1 = Date.now();
    const tokenRes = await fetch(tokenUrl, { method: 'GET', timeout: 30000 });
    const tokenText = await tokenRes.text();
    console.log(`${t2} ⬅️  oauth/access_token HTTP ${tokenRes.status} in ${Date.now() - t1}ms`);
    console.log(`${t2}    raw body: ${tokenText.replace(/("access_token"\s*:\s*")[^"]+/, '$1***')}`);
    let tokenJson = {};
    try { tokenJson = JSON.parse(tokenText); } catch (_) {}
    const accessToken = tokenJson.access_token;
    if (!tokenRes.ok || !accessToken) {
      console.log(`${t2} ❌ Token exchange failed`);
      return renderClose('שגיאה בהחלפת קוד', JSON.stringify(tokenJson.error || tokenJson), false);
    }
    console.log(`${t2} ✅ Got access_token (${accessToken.length} chars)`);

    // Step 2: list WABAs owned by the user to discover waba_id
    let waba_id = bot.waba_id || '';
    if (!waba_id) {
      const wabasUrl = `https://graph.facebook.com/${graphVersion}/me/businesses?access_token=${encodeURIComponent(accessToken)}`;
      console.log(`${t2} 🔁 Step 2a: discover WABAs via /me/businesses`);
      console.log(`${t2}    URL = ${wabasUrl.replace(accessToken, '***')}`);
      try {
        const r = await fetch(wabasUrl, { method: 'GET', timeout: 30000 });
        const txt = await r.text();
        console.log(`${t2} ⬅️  businesses HTTP ${r.status} body: ${txt}`);
      } catch (e) { console.log(`${t2} ⚠️ businesses fetch failed: ${e.message}`); }

      const debugUrl = `https://graph.facebook.com/${graphVersion}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appId + '|' + appSecret)}`;
      console.log(`${t2} 🔁 Step 2b: debug_token to extract granular_scopes/whatsapp_business_management ids`);
      try {
        const r = await fetch(debugUrl, { method: 'GET', timeout: 30000 });
        const txt = await r.text();
        console.log(`${t2} ⬅️  debug_token HTTP ${r.status} body: ${txt}`);
        const j = JSON.parse(txt);
        const granular = j?.data?.granular_scopes || [];
        const wabaScope = granular.find(s => s.scope === 'whatsapp_business_management');
        if (wabaScope && Array.isArray(wabaScope.target_ids) && wabaScope.target_ids.length > 0) {
          waba_id = wabaScope.target_ids[0];
          console.log(`${t2} ✅ Discovered waba_id=${waba_id} from debug_token`);
        }
      } catch (e) { console.log(`${t2} ⚠️ debug_token failed: ${e.message}`); }
    }

    // Step 3: phone_numbers under WABA
    let phoneInfo = null;
    let allPhones = [];
    if (waba_id) {
      const phoneFields = 'id,verified_name,display_phone_number,quality_rating,status,code_verification_status,name_status,messaging_limit_tier';
      const phonesUrl = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(waba_id)}/phone_numbers?fields=${encodeURIComponent(phoneFields)}&access_token=${encodeURIComponent(accessToken)}`;
      console.log(`${t2} 🔁 Step 3: GET /${waba_id}/phone_numbers`);
      console.log(`${t2}    URL = ${phonesUrl.replace(accessToken, '***')}`);
      const tt = Date.now();
      try {
        const r = await fetch(phonesUrl, { method: 'GET', timeout: 30000 });
        const txt = await r.text();
        console.log(`${t2} ⬅️  phone_numbers HTTP ${r.status} in ${Date.now() - tt}ms body: ${txt}`);
        const j = JSON.parse(txt);
        allPhones = Array.isArray(j.data) ? j.data : [];
        allPhones.forEach((p, idx) => console.log(`${t2}    [#${idx}] id=${p.id} display=${p.display_phone_number} status=${p.status} quality=${p.quality_rating}`));
        phoneInfo = allPhones[0] || null;
        if (phoneInfo) console.log(`${t2} ✅ Selected phone: id=${phoneInfo.id} display=${phoneInfo.display_phone_number}`);
      } catch (e) { console.log(`${t2} ⚠️ phone_numbers fetch threw: ${e.message}`); }
    } else {
      console.log(`${t2} ⚠️ No waba_id available — cannot fetch phone numbers`);
    }

    // Step 4: persist
    bot.waba_id = waba_id || bot.waba_id;
    bot.phone_number_id = (phoneInfo && phoneInfo.id) || bot.phone_number_id;
    bot.whatsapp_access_token = accessToken;
    bot.whatsapp_connected_at = new Date();
    bot.whatsapp_all_phones = allPhones;
    if (phoneInfo) {
      bot.display_phone_number = phoneInfo.display_phone_number || '';
      bot.whatsapp_verified_name = phoneInfo.verified_name || '';
      bot.whatsapp_quality_rating = phoneInfo.quality_rating || '';
      bot.whatsapp_status = phoneInfo.status || '';
      bot.whatsapp_code_verification_status = phoneInfo.code_verification_status || '';
      bot.whatsapp_name_status = phoneInfo.name_status || '';
      bot.whatsapp_messaging_limit_tier = phoneInfo.messaging_limit_tier || '';
    }
    await bot.save();
    console.log(`${t2} 💾 Saved bot. waba_id=${bot.waba_id} phone_number_id=${bot.phone_number_id} display=${bot.display_phone_number}`);

    // Step 5: auto-register
    let regResult = null;
    if (bot.phone_number_id) {
      regResult = await registerWhatsappNumber({
        phoneNumberId: bot.phone_number_id,
        accessToken,
        graphVersion,
        existingPin: bot.whatsapp_two_factor_pin,
        tag: t2
      });
      bot.whatsapp_two_factor_pin = regResult.pin;
      bot.whatsapp_registered = !!regResult.success;
      bot.whatsapp_register_response = regResult.responseBody;
      await bot.save();
    } else {
      console.log(`${t2} ⚠️ Step 5 skipped — no phone_number_id`);
    }
    console.log(`${'='.repeat(80)}\n`);

    const okMsg = `החיבור הושלם.<br>מספר: <strong>${bot.display_phone_number || '-'}</strong><br>שם עסק: <strong>${bot.whatsapp_verified_name || '-'}</strong><br>הפעלת מספר: <strong>${regResult && regResult.success ? 'הצליחה' : 'נכשלה / לא בוצעה'}</strong>`;
    return renderClose('החיבור הושלם בהצלחה', okMsg, true, {
      bot_id: bot._id.toString(),
      waba_id: bot.waba_id,
      phone_number_id: bot.phone_number_id,
      display_phone_number: bot.display_phone_number,
      verified_name: bot.whatsapp_verified_name,
      quality_rating: bot.whatsapp_quality_rating,
      status: bot.whatsapp_status,
      code_verification_status: bot.whatsapp_code_verification_status,
      name_status: bot.whatsapp_name_status,
      messaging_limit_tier: bot.whatsapp_messaging_limit_tier,
      registered: !!(regResult && regResult.success),
      register_status_code: regResult ? regResult.status : null,
      register_error: regResult && !regResult.success ? (regResult.responseBody?.error || regResult.responseBody) : null
    });
  } catch (err) {
    console.error(`${tag} ❌ Exception:`, err);
    return renderClose('שגיאה לא צפויה', err.message, false);
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

/**
 * Update the bot's public_id (used as the API token for get-reply-text).
 */
export const updateBotPublicId = async (req, res) => {
  const { id } = req.params;
  const { public_id } = req.body;
  const userId = req.user.id;
  const trimmed = String(public_id || '').trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'מזהה ציבורי לא יכול להיות ריק' });
  }
  try {
    const bot = await BotFlow.findOne({ _id: id, user_id: userId });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    const existing = await BotFlow.findOne({ public_id: trimmed, _id: { $ne: id } });
    if (existing) {
      return res.status(400).json({ error: 'מזהה ציבורי זה כבר בשימוש' });
    }
    bot.public_id = trimmed;
    await bot.save();
    res.json({ success: true, public_id: bot.public_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
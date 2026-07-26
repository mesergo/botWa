/**
 * WhatsApp registration flow — split into independently-callable stages so each
 * one can be triggered from an external system using the user's api_token.
 *
 *   Stage 1: POST /api/auth/register         → creates User with status='active'
 *                                              (only triggered by the in-app signup button).
 *   Stage 2: POST /api/whatsapp-registration/activate-number
 *              → Meta /{phone_number_id}/register + saves the number under
 *                user.connected_numbers[] (Bearer token identifies the user).
 *   Stage 3: POST /api/whatsapp-registration/link-number
 *              → For numbers activated OUTSIDE our system. Saves the number
 *                under user.connected_numbers[] without calling Meta.
 *              (No bot assignment yet — appears in Settings → Connected Numbers.)
 *   Stage 4: POST /api/whatsapp-registration/assign-to-bot
 *              → links a connected number to a specific bot (BotFlow).
 *   Stage 5: POST /api/whatsapp-registration/php-create
 *              → calls https://wa.message.co.il/facebook-create.php with the
 *                stored connected-number data to provision the external
 *                dialog360/account/user records. Can be invoked standalone
 *                or chained after Stage 4.
 */

import fetch from 'node-fetch';
import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import { getUserLimits } from '../utils/limits.js';

const GRAPH_VERSION = () => process.env.FB_GRAPH_VERSION || 'v20.0';
const PHP_CREATE_URL = () => process.env.PHP_CREATE_URL || 'https://wa.message.co.il/facebook-create.php';
const PHP_CREATE_TOKEN = () => process.env.PHP_CREATE_TOKEN || '356fa9e5eb6da01a4b5822f62b53545ba23860b6';
// API prefix uses the Graph version pinned by the PHP side (v22.0).
const PHP_GRAPH_VERSION = () => process.env.PHP_GRAPH_VERSION || 'v22.0';
// Long-lived FB system-user token used by the PHP side as `fbApiKey`.
const PHP_FB_API_KEY = () => process.env.PHP_FB_API_KEY || 'EAAKM0vGZBqFkBRjoCVH2zlRVZBs7zcBKEjmVLY1ZCYpkfXNSsNx51MpZBzphLJTaXbidwVglUZB2ZCDuDSpX3MGDYrE9xvOye7TFbHkPeFtGb0fA6BBdOZCHj7y6VZC9h54fdr8iYbXD6Wdt6iSyiLUZCQI4iFVj4ZCcPOwCgm6wXps8CXGvz63q777yZALXSXxUQZDZD';
// Fixed 2-step-verification PIN for WhatsApp number registration.
const FIXED_PIN = process.env.WA_FIXED_PIN || '93066';

function resolvePin(provided, existing) {
  if (provided && /^\d{5,6}$/.test(provided)) return provided;
  if (existing && /^\d{5,6}$/.test(existing)) return existing;
  return FIXED_PIN;
}
  
async function callMetaRegister({ phoneNumberId, accessToken, pin, tag }) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION()}/${encodeURIComponent(phoneNumberId)}/register`;
  console.log(`${tag} POST ${url}  pin=${pin}`);
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
    let body = {};
    try { body = JSON.parse(text); } catch (_) { body = { raw: text }; }
    const ok = r.ok && (body.success === true || body.success === 'true');
    console.log(`${tag} ← HTTP ${r.status} in ${Date.now() - t0}ms ok=${ok}`);
    return { success: ok, status: r.status, body };
  } catch (e) {
    console.log(`${tag} ← threw after ${Date.now() - t0}ms: ${e.message}`);
    return { success: false, status: 0, body: { error: e.message } };
  }
}

/**
 * Stage 2 — Activate a phone number on the WhatsApp Cloud API AND link it to
 * the authenticated user account.
 *
 *   POST /api/whatsapp-registration/activate-number
 *   Headers: Authorization: Bearer <jwt | api_token>
 *
 * Body (raw Meta JSON — same shape the Embedded-Signup popup returns):
 *   {
 *     "id" | "phone_number_id":  "403206936201771",   // required
 *     "access_token":            "EAAK...",            // required
 *     "pin":                     "123456",             // optional, 6 digits
 *     "wabaId" | "waba_id":      "403059862884906",   // optional
 *     "wabaName":                "Ohad's Bots",       // optional
 *     "verified_name":           "Ohad's Bots",       // optional
 *     "display_phone_number":    "+972 73-332-8792",  // optional
 *     "quality_rating":          "UNKNOWN",           // optional
 *     "status":                  "PENDING",           // optional
 *     "code_verification_status":"EXPIRED",           // optional
 *     "name_status":             "DECLINED"           // optional
 *   }
 *
 * Behaviour:
 *   1. Calls Meta `POST /{phone_number_id}/register` with the PIN.
 *   2. Saves / updates the number under `user.connected_numbers[]` (since the
 *      bearer token already identifies the account). The entry has
 *      `assigned_bot_id = null` and shows up in Settings → Connected Numbers
 *      with an "Assign to bot" option.
 *
 * Idempotent on phone_number_id: re-activating updates the existing entry
 * and reuses its PIN.
 */
export const activateNumber = async (req, res) => {
  const userId = req.user?.id;
  const b = req.body || {};
  const phone_number_id = b.phone_number_id || b.id;
  const tag = `[WA-Activate user=${userId} pnid=${phone_number_id}]`;

  if (!phone_number_id) return res.status(400).json({ error: 'missing_phone_number_id' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const existingEntry = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);

    // access_token: always use fixed system-user token for Meta API calls
    const access_token = PHP_FB_API_KEY();
    if (!access_token) return res.status(400).json({ error: 'missing_access_token' });

    // Quota check — only when adding a NEW number (not re-activating an existing one)
    if (!existingEntry) {
      const limits = await getUserLimits(user);
      const currentCount = (user.connected_numbers || []).length;
      if (currentCount >= limits.maxConnectedNumbers) {
        return res.status(403).json({
          error: 'quota_exceeded',
          message: 'המכסה נגמרה. יש ליצור קשר עם המשרד לתשלום להוספת מספר.',
          current: currentCount,
          max: limits.maxConnectedNumbers
        });
      }
    }

    const pin = resolvePin(b.pin, existingEntry?.pin || null);
    const result = await callMetaRegister({
      phoneNumberId: phone_number_id,
      accessToken: access_token,
      pin,
      tag
    });

    const payload = {
      phone_number_id,
      waba_id: b.waba_id || b.wabaId || existingEntry?.waba_id || '',
      display_phone_number: normalizePhone(b.display_phone_number ?? existingEntry?.display_phone_number ?? ''),
      verified_name: b.verified_name ?? existingEntry?.verified_name ?? '',
      quality_rating: b.quality_rating ?? existingEntry?.quality_rating ?? '',
      whatsapp_status: b.status ?? existingEntry?.whatsapp_status ?? '',
      access_token,
      registered: !!result.success || (existingEntry?.registered || false),
      pin,
      assigned_bot_id: existingEntry?.assigned_bot_id || null,
      connected_at: existingEntry?.connected_at || new Date()
    };
    if (existingEntry) {
      Object.assign(existingEntry, payload);
    } else {
      user.connected_numbers.push(payload);
    }
    await user.save();
    console.log(`${tag} → linked to user account (registered=${payload.registered})`);

    return res.status(result.success ? 200 : 502).json({
      success: result.success,
      phone_number_id,
      pin,
      meta_status: result.status,
      meta_response: result.body,
      connected_number: sanitizeNumber(payload)
    });
  } catch (err) {
    console.error(`${tag} exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Stage 3 — Link an (already activated) phone number to the authenticated user
 * account. Stores it in `user.connected_numbers[]` with `assigned_bot_id = null`,
 * so it appears in Settings → Connected Numbers, ready to be assigned to a bot.
 *
 *   POST /api/whatsapp-registration/link-number
 *
 * Accepts two body shapes:
 *
 * (A) Flat object (Embedded-Signup popup style):
 *   {
 *     "id" | "phone_number_id": "...",      // required
 *     "access_token":            "...",     // required
 *     "waba_id" | "wabaId":      "...",
 *     "display_phone_number":    "...",
 *     "verified_name":           "...",
 *     "quality_rating":          "...",
 *     "status":                  "...",
 *     "pin":                     "123456",
 *     "registered":              true
 *   }
 *
 * (B) WhatsApp webhook event shape (e.g. `phone_number_name_status`):
 *   {
 *     "object": "whatsapp_business_account",
 *     "access_token": "EAAK...",            // required — webhooks don't include it
 *     "entry": [{
 *       "id": "<waba_id>",
 *       "changes": [{
 *         "value": {
 *           "phone_number_id": "...",
 *           "display_phone_number": "...",
 *           "verified_name": "...",
 *           "status": "APPROVED",
 *           "quality_rating": "GREEN"
 *         },
 *         "field": "phone_number_name_status"
 *       }]
 *     }]
 *   }
 *
 * Idempotent on phone_number_id: re-linking updates the existing entry.
 */
export const linkNumber = async (req, res) => {
  const userId = req.user?.id;
  const raw = req.body || {};

  // ── Dialog360 path ──────────────────────────────────────────────────────────
  if (raw.type === 'dialog360') {
    const { token360, link } = raw;
    if (!token360) return res.status(400).json({ error: 'missing_token360' });
    if (!link) return res.status(400).json({ error: 'missing_link' });

    // token360 is unique per channel; link (base URL) is shared across all channels
    const phone_number_id = token360;
    const tag = `[WA-Link-D360 user=${userId} token=${token360.slice(0, 8)}...]`;

    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'user_not_found' });

      const existing = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);

      if (!existing) {
        const limits = await getUserLimits(user);
        const currentCount = (user.connected_numbers || []).length;
        if (currentCount >= limits.maxConnectedNumbers) {
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
        display_phone_number: raw.display_phone_number || existing?.display_phone_number || '',
        verified_name: raw.verified_name || existing?.verified_name || '',
        waba_id: existing?.waba_id || '',
        quality_rating: existing?.quality_rating || '',
        whatsapp_status: existing?.whatsapp_status || 'CONNECTED',
        access_token: '',
        registered: true,
        pin: '',
        assigned_bot_id: existing?.assigned_bot_id || null,
        connected_at: existing?.connected_at || new Date()
      };

      if (existing) {
        Object.assign(existing, payload);
        console.log(`${tag} updated existing dialog360 entry`);
      } else {
        user.connected_numbers.push(payload);
        console.log(`${tag} added new dialog360 entry`);
      }

      await user.save();
      return res.json({
        success: true,
        user_id: userId,
        user_status: user.status,
        connected_number: sanitizeNumber(payload),
        total_connected: user.connected_numbers.length
      });
    } catch (err) {
      console.error(`${tag} exception:`, err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Facebook / default path ──────────────────────────────────────────────────
  const b = normalizeLinkBody(raw);
  const phone_number_id = b.phone_number_id;
  const tag = `[WA-Link user=${userId} pnid=${phone_number_id}]`;

  if (!phone_number_id) return res.status(400).json({ error: 'missing_phone_number_id' });
  if (!b.access_token) return res.status(400).json({ error: 'missing_access_token' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const existing = (user.connected_numbers || []).find(
      n => n.phone_number_id === phone_number_id
    );

    // Quota check — only when adding a NEW number
    if (!existing) {
      const limits = await getUserLimits(user);
      const currentCount = (user.connected_numbers || []).length;
      if (currentCount >= limits.maxConnectedNumbers) {
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
      connected_at: existing?.connected_at || new Date()
    };

    if (existing) {
      Object.assign(existing, payload);
      console.log(`${tag} updated existing connected number entry`);
    } else {
      user.connected_numbers.push(payload);
      console.log(`${tag} added new connected number entry`);
    }

    await user.save();

    return res.json({
      success: true,
      user_id: userId,
      user_status: user.status,
      connected_number: sanitizeNumber(payload),
      total_connected: user.connected_numbers.length
    });
  } catch (err) {
    console.error(`${tag} exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/whatsapp-registration/connected-numbers
 * Returns the authenticated user's connected numbers (without access_token).
 */
export const listConnectedNumbers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('connected_numbers');
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    return res.json({
      success: true,
      connected_numbers: (user.connected_numbers || []).map(sanitizeNumber)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/whatsapp-registration/assign-to-bot
 * Body: { phone_number_id, bot_id }
 * Link a connected number to one of the user's bots. Copies the relevant
 * WhatsApp fields onto the BotFlow document so existing send/receive logic
 * keeps working unchanged.
 */
export const assignToBot = async (req, res) => {
  const userId = req.user?.id;
  const { phone_number_id, bot_id } = req.body || {};
  const tag = `[WA-Assign user=${userId} pnid=${phone_number_id} bot=${bot_id}]`;

  if (!phone_number_id) return res.status(400).json({ error: 'missing_phone_number_id' });
  if (!bot_id) return res.status(400).json({ error: 'missing_bot_id' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const entry = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);
    if (!entry) return res.status(404).json({ error: 'connected_number_not_found' });

    const bot = await BotFlow.findOne({ _id: bot_id, user_id: userId });
    if (!bot) return res.status(404).json({ error: 'bot_not_found' });

    // Copy WhatsApp fields onto the bot so existing controllers keep working.
    bot.phone_number_id = entry.phone_number_id;
    bot.waba_id = entry.waba_id || bot.waba_id;
    bot.display_phone_number = entry.display_phone_number || bot.display_phone_number;
    bot.whatsapp_verified_name = entry.verified_name || bot.whatsapp_verified_name;
    bot.whatsapp_quality_rating = entry.quality_rating || bot.whatsapp_quality_rating;
    bot.whatsapp_status = entry.whatsapp_status || bot.whatsapp_status;
    bot.whatsapp_access_token = entry.access_token || bot.whatsapp_access_token;
    bot.whatsapp_two_factor_pin = entry.pin || bot.whatsapp_two_factor_pin;
    bot.whatsapp_registered = entry.registered;
    bot.whatsapp_connected_at = new Date();
    // Provider-specific fields
    bot.whatsapp_provider = entry.provider || 'facebook';
    if (entry.provider === 'dialog360') {
      bot.dialog360_token = entry.token360 || bot.dialog360_token;
      bot.dialog360_link = entry.link || bot.dialog360_link;
    }
    await bot.save();

    entry.assigned_bot_id = bot._id;
    await user.save();
    console.log(`${tag} assigned`);

    return res.json({
      success: true,
      bot_id: bot._id.toString(),
      bot_name: bot.name,
      connected_number: sanitizeNumber(entry)
    });
  } catch (err) {
    console.error(`${tag} exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/whatsapp-registration/unassign-from-bot
 * Body: { phone_number_id }
 * Clears assigned_bot_id on the connected number (does NOT delete the bot's
 * WhatsApp fields — keeps the bot operational; just frees the number entry).
 */
export const unassignFromBot = async (req, res) => {
  const userId = req.user?.id;
  const { phone_number_id } = req.body || {};
  if (!phone_number_id) return res.status(400).json({ error: 'missing_phone_number_id' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const entry = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);
    if (!entry) return res.status(404).json({ error: 'connected_number_not_found' });
    entry.assigned_bot_id = null;
    await user.save();
    return res.json({ success: true, connected_number: sanitizeNumber(entry) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/whatsapp-registration/remove-connected-number
 * Body: { phone_number_id }
 * Permanently removes a connected number from the user's account.
 */
export const removeConnectedNumber = async (req, res) => {
  const userId = req.user?.id;
  const { phone_number_id } = req.body || {};
  const tag = `[WA-Remove user=${userId} pnid=${phone_number_id}]`;
  if (!phone_number_id) return res.status(400).json({ error: 'missing_phone_number_id' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const before = (user.connected_numbers || []).length;
    user.connected_numbers = user.connected_numbers.filter(
      n => n.phone_number_id !== phone_number_id
    );
    if (user.connected_numbers.length === before) {
      return res.status(404).json({ error: 'connected_number_not_found' });
    }
    user.markModified('connected_numbers');
    await user.save();
    console.log(`${tag} → removed`);
    return res.json({ success: true, total_connected: user.connected_numbers.length });
  } catch (err) {
    console.error(`${tag} exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/whatsapp-registration/mark-registered
 * Body: { phone_number_id }
 * Marks an existing connected number as registered=true in the DB without
 * contacting Meta. Useful for numbers activated via old code or external tools.
 */
export const markRegistered = async (req, res) => {
  const userId = req.user?.id;
  const { phone_number_id } = req.body || {};
  const tag = `[WA-MarkRegistered user=${userId} pnid=${phone_number_id}]`;
  if (!phone_number_id) return res.status(400).json({ error: 'missing_phone_number_id' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const entry = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);
    if (!entry) return res.status(404).json({ error: 'connected_number_not_found' });
    entry.registered = true;
    user.markModified('connected_numbers');
    await user.save();
    console.log(`${tag} → marked as registered`);
    return res.json({ success: true, connected_number: sanitizeNumber(entry) });
  } catch (err) {
    console.error(`${tag} exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Stage 5 — Provision the external dialog360 / accounts / users records via
 * the PHP endpoint at https://wa.message.co.il/facebook-create.php.
 *
 * Mirrors the Laravel `Http::get(...)` integration: sends a GET request with
 * all parameters in the query string, including a fixed `token`, the long-lived
 * `fbApiKey`, and an `apiPrefix` of
 * `https://graph.facebook.com/v22.0/{phone_number_id}`.
 *
 *   POST /api/whatsapp-registration/php-create
 *   Headers: Authorization: Bearer <jwt | api_token>
 *
 * Body (only `phone_number_id` is required — the rest is auto-filled from the
 * stored connected_numbers entry, with optional overrides):
 *   {
 *     "phone_number_id": "...",   // REQUIRED
 *     "waba_id":         "...",   // override (else taken from stored entry)
 *     "phone":           "...",   // override (else display_phone_number, digits only)
 *     "fbApiKey":        "...",   // override the fixed system token
 *     "countriesPrefix": "972|1", // default
 *     "exportUrl":       "",
 *     "firstname": "", "lastname": "", "username": "", "password": "",
 *     "shamirUsername": "", "shamirToken": "", "shamirBotId": "",
 *     "botCampaignCode": "",
 *     "botToken":        "...",   // default = entry.assigned_bot_id
 *     "botUserId":       "..."    // default = current authenticated user id
 *   }
 *
 * Returns the PHP endpoint's JSON response verbatim under `php_response`.
 */
export const createPhpAccount = async (req, res) => {
  const userId = req.user?.id;
  const b = req.body || {};
  const phone_number_id = b.phone_number_id || b.id;
  const tag = `[WA-PhpCreate user=${userId} pnid=${phone_number_id}]`;

  if (!phone_number_id) return res.status(400).json({ error: 'missing_phone_number_id' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const entry = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);
    if (!entry) return res.status(404).json({ error: 'connected_number_not_found' });

    const access_token = b.access_token || entry.access_token;
    const waba_id = b.waba_id || b.wabaId || entry.waba_id;
    const rawPhone = b.phone || entry.display_phone_number || '';
    const phone = String(rawPhone).replace(/\D+/g, '');

    if (!waba_id) return res.status(400).json({ error: 'missing_waba_id' });
    if (!phone || phone.length < 7) return res.status(400).json({ error: 'invalid_phone' });

    // Mirror the Laravel implementation: apiPrefix points at the phone-number
    // node on Graph v22.0 (without `/messages`); the PHP side appends paths.
    const apiPrefix = `https://graph.facebook.com/${PHP_GRAPH_VERSION()}/${encodeURIComponent(phone_number_id)}/`;

    // botToken = the bot's public_id (shown in bot settings).
    // botUserId = the user's public_id (shown in user settings).
    let botPublicId = '';
    if (entry.assigned_bot_id) {
      const assignedBot = await BotFlow.findById(entry.assigned_bot_id).select('public_id');
      botPublicId = assignedBot?.public_id || '';
    }
    const botToken = b.botToken || botPublicId || '';
    const botUserId = b.botUserId || user.public_id || String(userId || '');

    const params = {
      token: PHP_CREATE_TOKEN(),
      waba_id: String(waba_id),
      fbApiKey: b.fbApiKey || PHP_FB_API_KEY(),
      apiPrefix,
      phone,
      exportUrl: b.exportUrl || '',
      countriesPrefix: '972',
      firstname: b.firstname || '',
      lastname: b.lastname || '',
      username: b.username || '',
      password: b.password || '',
      shamirUsername: b.shamirUsername || '',
      shamirToken: b.shamirToken || '',
      shamirBotId: b.shamirBotId || '',
      botCampaignCode: b.botCampaignCode || '',
      botToken,
      botUserId
    };

    const qs = new URLSearchParams(params).toString();
    const url = `${PHP_CREATE_URL()}?${qs}`;
    console.log(`${tag} GET ${PHP_CREATE_URL()} phone=${phone} waba=${waba_id} bot=${botToken}`);
    const t0 = Date.now();

    let phpStatus = 0;
    let phpBody = {};
    let phpOk = false;
    try {
      const r = await fetch(url, { method: 'GET', timeout: 30000 });
      phpStatus = r.status;
      const text = await r.text();
      try { phpBody = JSON.parse(text); } catch (_) { phpBody = { raw: text }; }
      // phpOk: true only when the PHP returns a real success JSON (not HTML, not error)
      const isHtmlResponse = typeof phpBody?.raw === 'string' && phpBody.raw.trim().startsWith('<');
      if (isHtmlResponse) {
        console.log(`${tag} ← HTTP ${phpStatus} non-JSON (HTML) response — treating as failure`);
        phpBody = { success: false, error: 'php_returned_html', raw: phpBody.raw.slice(0, 200) };
      }
      phpOk = !isHtmlResponse && phpStatus >= 200 && phpStatus < 300 &&
        phpBody?.success === true && !phpBody?.error && !phpBody?.error_description;
      console.log(`${tag} ← HTTP ${phpStatus} in ${Date.now() - t0}ms ok=${phpOk}`);
    } catch (e) {
      console.log(`${tag} ← threw after ${Date.now() - t0}ms: ${e.message}`);
      // Return 200 with success:false — avoid nginx HTML error pages
      return res.status(200).json({ success: false, error: 'php_request_failed', detail: e.message, logs: [`❌ שגיאת רשת: ${e.message}`] });
    }

    const logs = [];
    let savedEndpoint = null;

    if (phpOk) {
      logs.push(`✅ החשבון נוצר בהצלחה`);
      if (phpBody.webhook) logs.push(`🔗 Webhook: ${phpBody.webhook}`);

      // Extract the MongoDB id returned by PHP and save it as the bot's endpoint
      const returnedOid = phpBody?.id?.['$oid'] || phpBody?.id?.$oid || (typeof phpBody?.id === 'string' ? phpBody.id : null);
      if (returnedOid && entry.assigned_bot_id) {
        try {
          const assignedBot = await BotFlow.findById(entry.assigned_bot_id);
          if (assignedBot) {
            assignedBot.endpoint = returnedOid;
            await assignedBot.save();
            savedEndpoint = returnedOid;
            console.log(`${tag} 💾 Saved bot.endpoint=${returnedOid} for bot=${assignedBot._id}`);
            logs.push(`🆔 Endpoint שמור לבוט: ${returnedOid}`);
          }
        } catch (e) {
          console.log(`${tag} ⚠️ Failed to save endpoint to bot: ${e.message}`);
          logs.push(`⚠️ לא הצלחנו לשמור את ה-endpoint לבוט: ${e.message}`);
        }
      } else if (phpBody.id) {
        logs.push(`🆔 ID: ${JSON.stringify(phpBody.id)}`);
      }
    } else {
      logs.push(`❌ הפעולה נכשלה (HTTP ${phpStatus})`);
      const errDesc = phpBody?.error_description || phpBody?.error || phpBody?.message || '';
      if (errDesc) logs.push(`פרטים: ${errDesc}`);
    }

    return res.status(200).json({
      success: phpOk,
      phone_number_id,
      logs,
      webhook: phpBody?.webhook || null,
      endpoint: savedEndpoint,
      sent: {
        apiPrefix,
        waba_id: String(waba_id),
        phone,
        countriesPrefix: params.countriesPrefix,
        botToken,
        botUserId
      },
      php_status: phpStatus,
      php_response: phpOk ? phpBody : undefined
    });
  } catch (err) {
    console.error(`${tag} exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

function sanitizeNumber(n) {
  const o = (typeof n.toObject === 'function') ? n.toObject() : n;
  const { access_token, pin, token360, ...rest } = o;
  return {
    ...rest,
    provider: o.provider || 'facebook',
    has_access_token: !!access_token,
    has_pin: !!pin,
    has_token360: !!token360,
    // Expose the dialog360 link (not sensitive) for display
    link: o.link || ''
  };
}

/** Strip all spaces, dashes and dots from a phone number string, keeping the leading '+'. */
function normalizePhone(phone) {
  if (!phone) return phone;
  return phone.replace(/[\s\-\.]/g, '');
}

/**
 * POST /api/whatsapp-registration/fetch-and-activate
 *
 * Two-step helper called from the dashboard "activate number" button:
 *   1. GET /{waba_id}/phone_numbers from Meta to discover the phone_number_id.
 *   2. For every phone found, call Meta POST /{phone_number_id}/register and
 *      upsert the number intocted_numbers (auto-assign to the bot
 *      that was passed as `bot_id`, if provided).
 *
 * Body:
 *   { waba_id, access_token, bot_id? }
 *
 * Returns:
 *   { success, logs[], phones[], activated[] }
 */
export const fetchAndActivate = async (req, res) => {
  const userId = req.user?.id;
  const b = req.body || {};
  const waba_id = b.waba_id || b.wabaId;
  const bot_id = b.bot_id || null;
  const tag = `[WA-FetchActivate user=${userId} waba=${waba_id}]`;
  const logs = [];
  const addLog = (msg) => { logs.push(msg); console.log(`${tag} ${msg}`); };

  if (!waba_id) return res.status(400).json({ error: 'missing_waba_id', logs });

  // Always use fixed system-user token for Meta API calls
  const access_token = PHP_FB_API_KEY();

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found', logs });

    // Step 1: fetch phone numbers for WABA
    const phoneFields = 'id,verified_name,display_phone_number,quality_rating,status,code_verification_status,name_status,messaging_limit_tier';
    const phonesUrl = `https://graph.facebook.com/${GRAPH_VERSION()}/${encodeURIComponent(waba_id)}/phone_numbers?fields=${encodeURIComponent(phoneFields)}&access_token=${encodeURIComponent(access_token)}`;
    addLog(`שלב 1: קבלת מספרי טלפון מ-Meta עבור WABA ${waba_id}`);

    let phones = [];
    try {
      const r = await fetch(phonesUrl, { method: 'GET', timeout: 30000 });
      const txt = await r.text();
      addLog(`Meta GET phone_numbers → HTTP ${r.status}`);
      const j = JSON.parse(txt);
      if (!r.ok || j.error) {
        addLog(`שגיאה מ-Meta: ${JSON.stringify(j.error || j)}`);
        return res.status(502).json({ success: false, logs, phones: [], activated: [], meta_error: j.error || j });
      }
      phones = Array.isArray(j.data) ? j.data : [];
      addLog(`נמצאו ${phones.length} מספרים: ${phones.map(p => p.display_phone_number || p.id).join(', ')}`);
    } catch (e) {
      addLog(`חריגה בבקשת phone_numbers: ${e.message}`);
      return res.status(502).json({ success: false, logs, phones: [], activated: [] });
    }

    if (phones.length === 0) {
      addLog('לא נמצאו מספרים עבור WABA זה.');
      return res.json({ success: false, logs, phones: [], activated: [] });
    }

    const limits = await getUserLimits(user);
    const activated = [];

    // Step 2: activate each phone
    for (const phone of phones) {
      const pnid = phone.id;
      addLog(`שלב 2: הפעלת מספר ${phone.display_phone_number || pnid}`);

      const existingEntry = (user.connected_numbers || []).find(n => n.phone_number_id === pnid);
      // Quota check for new numbers only
      if (!existingEntry) {
        const currentCount = (user.connected_numbers || []).length;
        if (currentCount >= limits.maxConnectedNumbers) {
          addLog(`מכסה מלאה (${currentCount}/${limits.maxConnectedNumbers}) — דילוג על ${pnid}`);
          continue;
        }
      }

      const pin = resolvePin(null, existingEntry?.pin || null);
      const regResult = await callMetaRegister({ phoneNumberId: pnid, accessToken: access_token, pin, tag });
      addLog(`הפעלת מספר ${phone.display_phone_number || pnid}: ${regResult.success ? '✅ הצליחה' : `❌ נכשלה (HTTP ${regResult.status})`}`);
      if (!regResult.success && regResult.body?.error) {
        addLog(`  שגיאה: ${JSON.stringify(regResult.body.error)}`);
      }

      // Upsert connected_numbers entry
      const payload = {
        phone_number_id: pnid,
        waba_id: waba_id || '',
        display_phone_number: normalizePhone(phone.display_phone_number || existingEntry?.display_phone_number || ''),
        verified_name: phone.verified_name || existingEntry?.verified_name || '',
        quality_rating: phone.quality_rating || existingEntry?.quality_rating || '',
        whatsapp_status: phone.status || existingEntry?.whatsapp_status || '',
        access_token,
        registered: !!regResult.success || (existingEntry?.registered || false),
        pin,
        assigned_bot_id: existingEntry?.assigned_bot_id || (bot_id || null),
        connected_at: existingEntry?.connected_at || new Date()
      };

      if (existingEntry) {
        Object.assign(existingEntry, payload);
        user.markModified('connected_numbers');
      } else {
        user.connected_numbers.push(payload);
      }

      addLog(`שמירת מספר ${phone.display_phone_number || pnid} למשתמש (registered=${payload.registered}, bot=${payload.assigned_bot_id || 'ללא'})`);
      activated.push({ phone_number_id: pnid, success: regResult.success, display_phone_number: phone.display_phone_number || '', registered: payload.registered });
    }

    await user.save();
    addLog('✅ כל המספרים עודכנו בהצלחה.');

    const allOk = activated.length > 0 && activated.every(a => a.success);
    return res.status(allOk ? 200 : 207).json({
      success: allOk,
      logs,
      phones,
      activated
    });
  } catch (err) {
    addLog(`חריגה: ${err.message}`);
    console.error(`${tag} exception:`, err);
    return res.status(500).json({ error: err.message, logs, phones: [], activated: [] });
  }
};

// Flattens a WhatsApp webhook payload (entry[].changes[].value) into the flat
// shape linkNumber works with. Pass-through for already-flat bodies.
function normalizeLinkBody(b) {
  if (b && Array.isArray(b.entry) && b.entry.length > 0) {
    const entry = b.entry[0] || {};
    const change = (entry.changes && entry.changes[0]) || {};
    const v = change.value || {};
    return {
      phone_number_id: v.phone_number_id || v.id || b.phone_number_id || b.id,
      waba_id: entry.id || v.waba_id || v.wabaId || b.waba_id || b.wabaId,
      display_phone_number: v.display_phone_number,
      verified_name: v.verified_name,
      quality_rating: v.quality_rating,
      status: v.status,
      pin: b.pin,
      registered: b.registered,
      access_token: b.access_token || v.access_token
    };
  }
  return {
    phone_number_id: b.phone_number_id || b.id,
    waba_id: b.waba_id || b.wabaId,
    display_phone_number: b.display_phone_number,
    verified_name: b.verified_name,
    quality_rating: b.quality_rating,
    status: b.status,
    pin: b.pin,
    registered: b.registered,
    access_token: b.access_token
  };
}

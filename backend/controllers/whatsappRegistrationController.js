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

function resolvePin(provided, existing) {
  if (provided && /^\d{6}$/.test(provided)) return provided;
  if (existing && /^\d{6}$/.test(existing)) return existing;
  return String(Math.floor(100000 + Math.random() * 900000));
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
  const access_token = b.access_token;
  const tag = `[WA-Activate user=${userId} pnid=${phone_number_id}]`;

  if (!phone_number_id) return res.status(400).json({ error: 'missing_phone_number_id' });
  if (!access_token) return res.status(400).json({ error: 'missing_access_token' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const existingEntry = (user.connected_numbers || []).find(n => n.phone_number_id === phone_number_id);

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
      display_phone_number: b.display_phone_number ?? existingEntry?.display_phone_number ?? '',
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
  const b = normalizeLinkBody(req.body || {});
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
      waba_id: b.waba_id || existing?.waba_id || '',
      display_phone_number: b.display_phone_number ?? existing?.display_phone_number ?? '',
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
    const apiPrefix = `https://graph.facebook.com/${PHP_GRAPH_VERSION()}/${encodeURIComponent(phone_number_id)}`;

    // botToken = id of the bot assigned to this number (if any).
    // botUserId = id of the account that owns the bot/number.
    const botToken = b.botToken || (entry.assigned_bot_id ? String(entry.assigned_bot_id) : '');
    const botUserId = b.botUserId || String(userId || '');

    const params = {
      token: PHP_CREATE_TOKEN(),
      waba_id: String(waba_id),
      fbApiKey: b.fbApiKey || PHP_FB_API_KEY(),
      apiPrefix,
      phone,
      exportUrl: b.exportUrl || '',
      countriesPrefix: b.countriesPrefix || '972|1',
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
      if (phpStatus === 401) {
        console.log(`${tag} ← HTTP 401 (invalid/missing token)`);
        return res.status(401).json({ error: 'invalid_token', php_response: phpBody });
      }
      if (phpStatus === 500) {
        console.log(`${tag} ← HTTP 500 ${JSON.stringify(phpBody).slice(0, 200)}`);
        return res.status(502).json({
          error: phpBody?.error_description || 'php_internal_error',
          php_response: phpBody
        });
      }
      phpOk = r.ok && (phpBody?.success === true || (!phpBody?.error && !phpBody?.error_description));
      console.log(`${tag} ← HTTP ${phpStatus} in ${Date.now() - t0}ms ok=${phpOk}`);
    } catch (e) {
      console.log(`${tag} ← threw after ${Date.now() - t0}ms: ${e.message}`);
      return res.status(502).json({ error: 'php_request_failed', detail: e.message });
    }

    return res.status(phpOk ? 200 : 502).json({
      success: phpOk,
      phone_number_id,
      sent: {
        apiPrefix,
        waba_id: String(waba_id),
        phone,
        countriesPrefix: params.countriesPrefix,
        botToken,
        botUserId
      },
      php_status: phpStatus,
      php_response: phpBody
    });
  } catch (err) {
    console.error(`${tag} exception:`, err);
    return res.status(500).json({ error: err.message });
  }
};

function sanitizeNumber(n) {
  const o = (typeof n.toObject === 'function') ? n.toObject() : n;
  const { access_token, pin, ...rest } = o;
  return {
    ...rest,
    has_access_token: !!access_token,
    has_pin: !!pin
  };
}

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

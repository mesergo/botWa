import BotFlow from '../models/BotFlow.js';
import { normalizePhone } from '../utils/phone.js';

/**
 * GET /api/whatsapp/webhook — Meta verification handshake.
 * Meta sends ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y
 * We must echo back hub.challenge if the verify_token matches.
 */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.FB_WEBHOOK_VERIFY_TOKEN;

  console.log(`[WA-Webhook] 🔐 Verification request: mode=${mode} token=${token ? token.substring(0, 4) + '…' : 'MISSING'} challenge=${challenge}`);

  if (!expected) {
    console.log('[WA-Webhook] ❌ FB_WEBHOOK_VERIFY_TOKEN env var is not set on the server');
    return res.status(500).send('server_not_configured');
  }
  if (mode === 'subscribe' && token === expected) {
    console.log('[WA-Webhook] ✅ Verified — echoing challenge back to Meta');
    return res.status(200).send(challenge);
  }
  console.log('[WA-Webhook] ❌ Verification failed (mode or token mismatch)');
  return res.sendStatus(403);
};

/**
 * POST /api/whatsapp/webhook — Receive WhatsApp Business Account events.
 *
 * Example payload (phone_number_name_status change):
 * {
 *   "object": "whatsapp_business_account",
 *   "entry": [{
 *     "id": "<WABA_ID>",
 *     "time": 1780224361,
 *     "changes": [{
 *       "field": "phone_number_name_status",
 *       "value": {
 *         "phone_number_id": "...",
 *         "display_phone_number": "+972...",
 *         "verified_name": "…",
 *         "status": "APPROVED",
 *         "quality_rating": "GREEN",
 *         "code_verification_status": "VERIFIED",
 *         "name_status": "APPROVED",
 *         "event": "phone_verified",
 *         "messaging_limit_tier": "TIER_1K"
 *       }
 *     }]
 *   }]
 * }
 *
 * For every relevant change we locate the BotFlow by phone_number_id (or waba_id)
 * and update its WhatsApp status fields. Always respond 200 quickly so Meta
 * does not retry.
 */
export const receiveWebhook = async (req, res) => {
  // Respond immediately — Meta requires 200 within ~20s and will retry otherwise.
  res.sendStatus(200);

  try {
    const body = req.body || {};
    console.log(`\n${'='.repeat(80)}`);
    console.log('[WA-Webhook] 📥 Incoming event');
    console.log(`[WA-Webhook]    object = ${body.object}`);
    console.log(`[WA-Webhook]    full payload: ${JSON.stringify(body)}`);

    if (body.object !== 'whatsapp_business_account') {
      console.log(`[WA-Webhook] ⏭  Ignoring — not a whatsapp_business_account event`);
      console.log(`${'='.repeat(80)}\n`);
      return;
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const wabaId = entry.id;
      console.log(`[WA-Webhook] 📦 entry waba_id=${wabaId} time=${entry.time}`);
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const change of changes) {
        const field = change.field;
        const value = change.value || {};
        console.log(`[WA-Webhook]   ▶ change field=${field}`);
        console.log(`[WA-Webhook]     value=${JSON.stringify(value)}`);

        const phoneId = value.phone_number_id;

        switch (field) {
          // ── Phone number related events (signup completion, name/verify status) ──
          case 'phone_number_name_status':
          case 'phone_number_quality_update':
          case 'account_review_update':
          case 'business_capability_update':
          case 'phone_number_update': {
            if (!phoneId && !wabaId) {
              console.log(`[WA-Webhook]     ⏭ no phone_number_id or waba_id — cannot route`);
              break;
            }
            const query = phoneId ? { phone_number_id: phoneId } : { waba_id: wabaId };
            const bot = await BotFlow.findOne(query);
            if (!bot) {
              console.log(`[WA-Webhook]     ⚠️  No BotFlow found for query=${JSON.stringify(query)}`);
              break;
            }
            console.log(`[WA-Webhook]     🎯 Matched BotFlow _id=${bot._id} name="${bot.name}"`);

            const before = {
              status: bot.whatsapp_status,
              name_status: bot.whatsapp_name_status,
              code_verification: bot.whatsapp_code_verification_status,
              quality: bot.whatsapp_quality_rating,
              tier: bot.whatsapp_messaging_limit_tier,
              registered: bot.whatsapp_registered,
            };

            if (value.display_phone_number)         bot.display_phone_number = normalizePhone(value.display_phone_number);
            if (value.verified_name)                bot.whatsapp_verified_name = value.verified_name;
            if (value.status)                       bot.whatsapp_status = value.status;
            if (value.quality_rating)               bot.whatsapp_quality_rating = value.quality_rating;
            if (value.code_verification_status)     bot.whatsapp_code_verification_status = value.code_verification_status;
            if (value.name_status)                  bot.whatsapp_name_status = value.name_status;
            if (value.messaging_limit_tier)         bot.whatsapp_messaging_limit_tier = value.messaging_limit_tier;
            if (!bot.waba_id && wabaId)             bot.waba_id = wabaId;

            // A "phone_verified" event with status=APPROVED + code_verification=VERIFIED
            // means the number is fully active on the Cloud API.
            const isVerifiedNow =
              value.event === 'phone_verified' ||
              (value.status === 'APPROVED' && value.code_verification_status === 'VERIFIED');
            if (isVerifiedNow) {
              bot.whatsapp_registered = true;
              console.log(`[WA-Webhook]     ✅ Marking bot as fully registered (phone verified & APPROVED)`);
            }

            await bot.save();
            const after = {
              status: bot.whatsapp_status,
              name_status: bot.whatsapp_name_status,
              code_verification: bot.whatsapp_code_verification_status,
              quality: bot.whatsapp_quality_rating,
              tier: bot.whatsapp_messaging_limit_tier,
              registered: bot.whatsapp_registered,
            };
            console.log(`[WA-Webhook]     💾 BotFlow updated.`);
            console.log(`[WA-Webhook]        before: ${JSON.stringify(before)}`);
            console.log(`[WA-Webhook]        after : ${JSON.stringify(after)}`);
            break;
          }

          // ── Incoming WhatsApp messages / status callbacks ──
          // (not the signup flow — left as a no-op for now, just logged)
          case 'messages': {
            const msgs = Array.isArray(value.messages) ? value.messages : [];
            const statuses = Array.isArray(value.statuses) ? value.statuses : [];
            console.log(`[WA-Webhook]     💬 messages=${msgs.length} statuses=${statuses.length} (not processed here)`);
            break;
          }

          default:
            console.log(`[WA-Webhook]     ⏭ field "${field}" not handled (logged only)`);
        }
      }
    }
    console.log(`${'='.repeat(80)}\n`);
  } catch (err) {
    console.error('[WA-Webhook] ❌ Exception while processing webhook:', err);
  }
};

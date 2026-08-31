// Staggered daily "active contacts" quota check + office alert email.
// Follows the "tick often, act only when due" idiom used by
// sessionController.js's case1/case2 reminder tickers: a frequent ticker (every 30 min)
// only processes accounts whose active_contacts_next_check_at is due, then reschedules
// each one 24h out — this spreads load across the day instead of a once-daily spike.
// See plan: activeContactsQuota.
import mongoose from 'mongoose';
import User from '../models/User.js';
import SystemSetting from '../models/SystemSetting.js';
import { getUserLimits, getActiveContactsWindowDays } from './limits.js';
import { computeActiveContactsCount } from './activeContacts.js';

const TICK_MS = 30 * 60 * 1000; // check for due accounts every 30 min
const RECHECK_MS = 24 * 60 * 60 * 1000; // recompute each account once per 24h
const ALERT_DEDUPE_MS = 20 * 60 * 60 * 1000; // don't re-send the office email more than once per ~day
const BATCH_LIMIT = 200; // cap per tick so a large backlog doesn't block the event loop
const INITIAL_RUN_DELAY_MS = 60 * 1000; // let the DB connection settle on startup

const sendOfficeQuotaAlertEmail = async (user, count, limit) => {
  // const officeEmail = process.env.OFFICE_ALERT_EMAIL || 'go@mesergo.co.il';
  const officeEmail = process.env.OFFICE_ALERT_EMAIL || 'margalitw@mesergo.co.il';

  const emailUsername = process.env.MESERGO_EMAIL_USERNAME || 'admin@chatgo.live';
  const emailToken = process.env.MESERGO_EMAIL_TOKEN || '1aa14226-ceae-4104-ba86-899eca88631d';
  const fromAddress = process.env.MESERGO_FROM_ADDRESS || 'admin@chatgo.live';

  const nameSafe = (user.name || '').replace(/[<>'"]/g, '');
  const emailSafe = (user.email || '').replace(/[<>'"]/g, '');
  const phoneSafe = (user.phone || '').replace(/[<>'"]/g, '');

  const subject = `לקוח חרג ממכסת אנשי הקשר הפעילים - ${nameSafe}`;
  const htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#dc2626;">חריגה ממכסת אנשי קשר פעילים</h2>
  <p>הלקוח <strong>${nameSafe}</strong> חרג ממכסת אנשי הקשר הפעילים בחשבונו.</p>
  <ul>
    <li>שם: ${nameSafe}</li>
    <li>אימייל: ${emailSafe}</li>
    <li>טלפון: ${phoneSafe}</li>
    <li>סוג חשבון: ${user.account_type || ''}</li>
    <li>מונה נוכחי: ${count}</li>
    <li>מכסה: ${limit}</li>
  </ul>
</div>`;

  const xmlString = `<InfoMailClient>
<SendEmails>
<User>
<Username>${emailUsername}</Username>
<Token>${emailToken}</Token>
</User>
<Message>
<CampaignName>חריגת מכסת אנשי קשר - ${nameSafe}</CampaignName>
<FromAddress>${fromAddress}</FromAddress>
<FromName>Bot Flow</FromName>
<Subject><![CDATA[${subject}]]></Subject>
<Body><![CDATA[${htmlBody}]]></Body>
</Message>
<Recipients>
<Email address="${officeEmail}" />
</Recipients>
</SendEmails>
</InfoMailClient>`;

  const encodedXml = encodeURIComponent(xmlString);
  const mailUrl = `https://capi.mesergo.co.il/mail/api.php?xml=${encodedXml}`;
  await fetch(mailUrl, { method: 'GET' });
};

const getAccountsConfig = async () => {
  try {
    const setting = await SystemSetting.findOne({ key: 'accounts_config' });
    if (setting) return setting.value;
  } catch (err) {
    console.error('[activeContactsTicker] Failed to load system settings:', err.message);
  }
  return {};
};

export const runActiveContactsTick = async () => {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;

  const now = new Date();
  const accountsConfig = await getAccountsConfig();
  const windowDays = getActiveContactsWindowDays(accountsConfig);

  // Only top-level accounts (reps/rep_managers have manager_id set and don't carry
  // their own quota fields — they're excluded naturally by this filter).
  const candidates = await User.find({
    manager_id: null,
    $or: [
      { active_contacts_next_check_at: null },
      { active_contacts_next_check_at: { $lte: now } }
    ]
  })
    .sort({ active_contacts_next_check_at: 1 })
    .limit(BATCH_LIMIT);

  for (const user of candidates) {
    try {
      // Sequential by design to keep DB/API contention low, same as the session reminder tickers.
      // eslint-disable-next-line no-await-in-loop
      const count = await computeActiveContactsCount(user._id.toString(), windowDays);
      // eslint-disable-next-line no-await-in-loop
      const limits = await getUserLimits(user);
      const limit = limits.maxActiveContacts ?? 0;
      const exceeded = limit > 0 && count > limit;

      user.active_contacts_count = count;
      user.active_contacts_computed_at = now;
      user.active_contacts_next_check_at = new Date(now.getTime() + RECHECK_MS);

      if (exceeded) {
        user.active_contacts_quota_exceeded = true;
        const lastAlertAt = user.active_contacts_last_alert_at ? new Date(user.active_contacts_last_alert_at).getTime() : 0;
        if (now.getTime() - lastAlertAt >= ALERT_DEDUPE_MS) {
          // eslint-disable-next-line no-await-in-loop
          await sendOfficeQuotaAlertEmail(user, count, limit);
          user.active_contacts_last_alert_at = now;
        }
      } else {
        user.active_contacts_quota_exceeded = false;
        user.active_contacts_last_alert_at = null;
      }

      // eslint-disable-next-line no-await-in-loop
      await user.save();
    } catch (err) {
      console.error('[activeContactsTicker] candidate error:', err.message);
    }
  }
};

setTimeout(() => {
  runActiveContactsTick().catch((err) => {
    console.error('[activeContactsTicker] initial run error:', err.message);
  });
}, INITIAL_RUN_DELAY_MS);

setInterval(() => {
  runActiveContactsTick().catch((err) => {
    console.error('[activeContactsTicker] ticker error:', err.message);
  });
}, TICK_MS);

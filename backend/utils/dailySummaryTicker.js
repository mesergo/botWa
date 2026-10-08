// "סיכום יומי במייל" — per-user daily activity summary email.
// Same "tick often, act only when due" idiom as activeContactsTicker.js: every few minutes,
// find users whose selected weekday/hour (Asia/Jerusalem) has arrived and who were not
// yet sent today's summary; claim atomically (safe across PM2 cluster workers) and send.
import mongoose from 'mongoose';
import User from '../models/User.js';
import BotSession from '../models/BotSession.js';
import Notification from '../models/Notification.js';
import EmailAlertLog from '../models/EmailAlertLog.js';
import { escapeHtml, getSystemBaseUrl, sendMesergoEmail } from '../../notifications/backend/infrastructure/email/mesergoMailer.js';

const TICK_MS = 5 * 60 * 1000;
const INITIAL_RUN_DELAY_MS = 60 * 1000;
const BATCH_LIMIT = 200;
const WAITING_LIST_LIMIT = 20;
const TZ = 'Asia/Jerusalem';
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const NOTIFICATION_TYPE_LABELS = {
  transfer: 'העברות שיחה',
  session_case1_reminder: 'תזכורות - ממתין לתגובת לקוח',
  session_case2_waiting: 'תזכורות - לקוח ממתין למענה',
};

/** Current date parts in Israel time. */
const getIsraelNow = (now) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    dow: WEEKDAYS[parts.weekday],
  };
};

/** UTC instant of 00:00 Israel time on the given 'YYYY-MM-DD'. */
const startOfIsraelDay = (dateStr) => {
  const asUtc = new Date(`${dateStr}T00:00:00Z`);
  // Offset of Israel vs UTC at that moment (handles DST)
  const tzHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(asUtc));
  const offsetHours = tzHour >= 12 ? tzHour - 24 : tzHour;
  return new Date(asUtc.getTime() - offsetHours * 60 * 60 * 1000);
};

const buildSummaryHtml = ({ dateStr, newConversations, waiting, notificationCounts, offlineAlerts }) => {
  const base = getSystemBaseUrl();
  const [y, m, d] = dateStr.split('-');
  const row = (label, value) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:bold;text-align:left;">${value}</td></tr>`;

  const notifRows = Object.entries(NOTIFICATION_TYPE_LABELS)
    .map(([type, label]) => row(label, notificationCounts[type] || 0))
    .join('');

  const waitingHtml = waiting.length
    ? `<ul style="padding-right:18px;">${waiting.map((s) => {
      const phone = s.sender || s.customer_phone || '';
      const name = s.parameters?.waName || '';
      const link = `${base}/sessions?phone=${encodeURIComponent(phone)}`;
      return `<li style="margin-bottom:6px;"><a href="${escapeHtml(link)}" style="color:#2563eb;">${escapeHtml(name || phone)}</a>${name ? ` <span style="color:#64748b;">(${escapeHtml(phone)})</span>` : ''}</li>`;
    }).join('')}</ul>`
    : '<p style="color:#16a34a;">אין שיחות ממתינות למענה 🎉</p>';

  const offlineHtml = offlineAlerts.length
    ? `<ul style="padding-right:18px;">${offlineAlerts.map((a) => {
      const time = new Date(a.createdAt).toLocaleTimeString('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
      return `<li>${time} — ${escapeHtml(a.customer_name || a.customer_phone || 'לקוח')}</li>`;
    }).join('')}</ul>`
    : '<p style="color:#64748b;">לא נשלחו התראות היום.</p>';

  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#2563eb;">סיכום יומי — ${d}/${m}/${y}</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    ${row('שיחות חדשות היום', newConversations)}
    ${row('שיחות ממתינות למענה כעת', waiting.length >= WAITING_LIST_LIMIT ? `${WAITING_LIST_LIMIT}+` : waiting.length)}
    ${notifRows}
    ${row('התראות "לא מחובר" שנשלחו', offlineAlerts.length)}
  </table>
  <h3 style="color:#334155;">שיחות ממתינות למענה</h3>
  ${waitingHtml}
  <h3 style="color:#334155;">התראות שנשלחו בזמן שלא היית מחובר/ת</h3>
  ${offlineHtml}
  <a href="${escapeHtml(`${base}/sessions`)}" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">מעבר לשיחות</a>
  <p style="margin-top:20px;color:#94a3b8;font-size:12px;">ניתן לשנות או לבטל את הסיכום היומי בהגדרות → התראות.</p>
</div>`;
};

const sendSummaryForUser = async (user, dateStr) => {
  const userId = String(user._id);
  const tenantId = user.manager_id || userId;
  const since = startOfIsraelDay(dateStr);

  const [newConversations, waiting, notifAgg, offlineAlerts] = await Promise.all([
    BotSession.countDocuments({ user_id: tenantId, createdAt: { $gte: since } }),
    BotSession.find({ user_id: tenantId, is_agent: true, status: 'waiting' })
      .select('sender customer_phone parameters.waName updatedAt')
      .sort({ updatedAt: -1 })
      .limit(WAITING_LIST_LIMIT)
      .lean(),
    Notification.aggregate([
      { $match: { user_id: userId, createdAt: { $gte: since } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    EmailAlertLog.find({ user_id: userId, kind: 'offline', createdAt: { $gte: since } })
      .select('customer_name customer_phone createdAt')
      .sort({ createdAt: 1 })
      .lean(),
  ]);
  const notificationCounts = Object.fromEntries(notifAgg.map((n) => [n._id, n.count]));

  const [y, m, d] = dateStr.split('-');
  await sendMesergoEmail({
    to: user.email,
    subject: `סיכום יומי ${d}/${m}/${y} — ${newConversations} שיחות חדשות, ${waiting.length} ממתינות`,
    htmlBody: buildSummaryHtml({ dateStr, newConversations, waiting, notificationCounts, offlineAlerts }),
    campaignName: `סיכום יומי - ${userId} - ${dateStr}`,
  });
  await EmailAlertLog.create({ user_id: userId, kind: 'daily_summary' });
};

export const runDailySummaryTick = async () => {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;

  const { date, hour, dow } = getIsraelNow(new Date());
  const candidates = await User.find({
    'daily_summary.enabled': true,
    'daily_summary.days': dow,
    'daily_summary.hour': { $lte: hour },
    'daily_summary.last_sent_date': { $ne: date },
    role: { $ne: 'rep' },
    email: { $nin: [null, ''] },
  })
    .select('_id')
    .limit(BATCH_LIMIT)
    .lean();

  for (const { _id } of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const user = await User.findOneAndUpdate(
      { _id, 'daily_summary.last_sent_date': { $ne: date } },
      { $set: { 'daily_summary.last_sent_date': date } },
      { new: true }
    ).select('_id email manager_id').lean();
    if (!user) continue; // claimed by another worker
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendSummaryForUser(user, date);
    } catch (err) {
      console.error('[dailySummaryTicker] send failed for user', String(_id), err?.message || err);
      // Release the claim so the next tick retries
      // eslint-disable-next-line no-await-in-loop
      await User.updateOne(
        { _id, 'daily_summary.last_sent_date': date },
        { $set: { 'daily_summary.last_sent_date': null } }
      ).catch(() => {});
    }
  }
};

setTimeout(() => {
  runDailySummaryTick().catch((err) => {
    console.error('[dailySummaryTicker] initial run error:', err.message);
  });
}, INITIAL_RUN_DELAY_MS);

setInterval(() => {
  runDailySummaryTick().catch((err) => {
    console.error('[dailySummaryTicker] ticker error:', err.message);
  });
}, TICK_MS);

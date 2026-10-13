/**
 * "התראה כשאינני מחובר" — one immediate email per offline period.
 *
 * A user is "offline" when no presence heartbeat arrived for OFFLINE_AFTER_MS
 * (see POST /api/push-notifications/presence). The first new inquiry while offline
 * claims `offline_alert_sent_at` atomically (safe across PM2 cluster workers) and
 * sends one email; further inquiries are silent until the next heartbeat resets it.
 */

import { escapeHtml, getSystemBaseUrl, sendMesergoEmail } from './mesergoMailer.js';

export const OFFLINE_AFTER_MS = 3 * 60 * 1000;

/**
 * @param {{ tenantId: string, sessionId: string, customerName?: string, customerPhone?: string,
 *   previewText?: string, clickAction?: string, isNewConversation?: boolean }} event
 */
export async function notifyOfflineUsers(event) {
  if (!event?.tenantId) return;
  const User = (await import('../../../../backend/models/User.js')).default;
  const EmailAlertLog = (await import('../../../../backend/models/EmailAlertLog.js')).default;

  // Account owner + sub-users of the same account (reps excluded)
  const candidates = await User.find({
    $or: [{ _id: event.tenantId }, { manager_id: event.tenantId }],
    role: { $ne: 'rep' },
    offline_email_enabled: true,
    offline_alert_sent_at: null,
    email: { $nin: [null, ''] },
  }).select('_id').lean();
  if (!candidates.length) return;

  const now = new Date();
  const cutoff = new Date(now.getTime() - OFFLINE_AFTER_MS);
  const name = event.customerName || event.customerPhone || 'לקוח';
  const link = `${getSystemBaseUrl()}${event.clickAction || '/sessions'}`;
  const preview = escapeHtml(event.previewText || '');
  const subject = event.isNewConversation
    ? `פנייה חדשה מ${name} התקבלה בזמן שלא היית מחובר/ת`
    : `הודעה חדשה מ${name} ממתינה למענה`;
  const htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#2563eb;">פנייה חדשה התקבלה בזמן שלא היית מחובר/ת</h2>
  <p><strong>${escapeHtml(name)}</strong>${event.customerPhone && event.customerPhone !== name ? ` (${escapeHtml(event.customerPhone)})` : ''} ${event.isNewConversation ? 'פתח/ה שיחה חדשה' : 'שלח/ה הודעה בשיחה שממתינה למענה'}.</p>
  ${preview ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px 16px;color:#334155;">${preview}</p>` : ''}
  <a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">מעבר לשיחה</a>
  <p style="margin-top:20px;color:#64748b;font-size:13px;">זו התראה אחת בלבד — לא יישלחו מיילים נוספים עד שתיכנס/י שוב למערכת.</p>
  <p style="color:#94a3b8;font-size:12px;">ניתן לבטל התראה זו בהגדרות → התראות.</p>
</div>`;

  await Promise.all(candidates.map(async ({ _id }) => {
    try {
      const claimed = await User.findOneAndUpdate(
        {
          _id,
          offline_email_enabled: true,
          offline_alert_sent_at: null,
          $or: [{ last_active_at: null }, { last_active_at: { $lt: cutoff } }],
        },
        { $set: { offline_alert_sent_at: now } },
        { new: true }
      ).select('_id email').lean();
      if (!claimed?.email) return;

      try {
        await sendMesergoEmail({
          to: claimed.email,
          subject,
          htmlBody,
          campaignName: `התראת לא מחובר - ${event.sessionId}`,
        });
      } catch (sendErr) {
        // Release the claim so the next inquiry can retry
        await User.updateOne({ _id, offline_alert_sent_at: now }, { $set: { offline_alert_sent_at: null } }).catch(() => {});
        throw sendErr;
      }
      await EmailAlertLog.create({
        user_id: String(claimed._id),
        kind: 'offline',
        session_id: event.sessionId ? String(event.sessionId) : null,
        customer_phone: event.customerPhone || '',
        customer_name: event.customerName || '',
      });
    } catch (err) {
      console.error('[notifications] offline alert failed for user', String(_id), err?.message || err);
    }
  }));
}

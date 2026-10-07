/**
 * Email mirror of the waiting-customer push, for users who opted in (User.push_email_enabled).
 * Sent through the Mesergo mail API (same as invite emails in subUserController).
 * Throttled: at most one email per user per conversation per THROTTLE_MS.
 */

const THROTTLE_MS = 15 * 60 * 1000;

/** @type {Map<string, number>} `${userId}:${conversationId}` → last sent timestamp */
const lastSentAt = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSystemBaseUrl() {
  const raw = (process.env.SYSTEM_URL || 'https://botwa.message.co.il').trim();
  return raw.replace(/\/+$/, '');
}

function claimSlot(key, now) {
  const last = lastSentAt.get(key);
  if (last && now - last < THROTTLE_MS) return false;
  lastSentAt.set(key, now);
  if (lastSentAt.size > 5000) {
    for (const [k, t] of lastSentAt) {
      if (now - t >= THROTTLE_MS) lastSentAt.delete(k);
    }
  }
  return true;
}

async function sendMesergoEmail({ to, subject, htmlBody, campaignName }) {
  const emailUsername = process.env.MESERGO_EMAIL_USERNAME || 'admin@chatgo.live';
  const emailToken = process.env.MESERGO_EMAIL_TOKEN || '1aa14226-ceae-4104-ba86-899eca88631d';
  const fromAddress = process.env.MESERGO_FROM_ADDRESS || 'admin@chatgo.live';

  const xmlString = `<InfoMailClient>
<SendEmails>
<User>
<Username>${emailUsername}</Username>
<Token>${emailToken}</Token>
</User>
<Message>
<CampaignName>${escapeHtml(campaignName)}</CampaignName>
<FromAddress>${fromAddress}</FromAddress>
<FromName>Bot Flow</FromName>
<Subject><![CDATA[${subject}]]></Subject>
<Body><![CDATA[${htmlBody}]]></Body>
</Message>
<Recipients>
<Email address="${escapeHtml(to)}" />
</Recipients>
</SendEmails>
</InfoMailClient>`;

  const res = await fetch(`https://capi.mesergo.co.il/mail/api.php?xml=${encodeURIComponent(xmlString)}`, { method: 'GET' });
  const rawText = await res.text().catch(() => '');
  const status = rawText.match(/<Status>(.*?)<\/Status>/)?.[1]?.trim();
  if (!res.ok || status !== 'Success') {
    throw new Error(`Mesergo mail API responded ${res.status}: ${rawText.slice(0, 300)}`);
  }
  console.log('[notifications] email sent to', to, 'campaign', rawText.match(/<CampaignId>(.*?)<\/CampaignId>/)?.[1]);
}

/**
 * Test email for the "שלח התראת בדיקה" button — only when the user opted in to email alerts.
 * @param {string} userId
 * @returns {Promise<boolean>} true when an email was sent
 */
export async function sendTestEmailToUser(userId) {
  const User = (await import('../../../../backend/models/User.js')).default;
  const user = await User.findById(userId).select('email push_email_enabled role').lean();
  if (!user?.push_email_enabled || !user.email || user.role === 'rep') {
    console.log('[notifications] test email skipped:', {
      userId,
      push_email_enabled: user?.push_email_enabled,
      hasEmail: Boolean(user?.email),
      role: user?.role,
    });
    return false;
  }

  const link = `${getSystemBaseUrl()}/sessions`;
  await sendMesergoEmail({
    to: user.email,
    subject: 'בדיקת התראות במייל',
    htmlBody: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#2563eb;">התראות במייל עובדות ✓</h2>
  <p>מעכשיו תקבל/י כאן מייל כשלקוח כותב בשיחה שממתינה למענה.</p>
  <a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">מעבר לשיחות</a>
</div>`,
    campaignName: `בדיקת התראות במייל - ${userId}`,
  });
  return true;
}

/**
 * @param {{ userIds: string[], event: { conversationId: string, senderDisplayName?: string, previewText?: string, clickAction?: string } }} args
 */
export async function notifyWaitingCustomerByEmail({ userIds, event }) {
  if (!userIds?.length) return;
  const User = (await import('../../../../backend/models/User.js')).default;
  const users = await User.find({ _id: { $in: userIds }, push_email_enabled: true, role: { $ne: 'rep' } })
    .select('_id email')
    .lean();

  const now = Date.now();
  const sender = escapeHtml(event.senderDisplayName || 'לקוח');
  const preview = escapeHtml(event.previewText || '');
  const link = `${getSystemBaseUrl()}${event.clickAction || '/sessions'}`;

  const subject = `הודעה חדשה מ${event.senderDisplayName || 'לקוח'} ממתינה למענה`;
  const htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#2563eb;">הודעה חדשה ממתינה למענה</h2>
  <p><strong>${sender}</strong> שלח/ה הודעה:</p>
  ${preview ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px 16px;color:#334155;">${preview}</p>` : ''}
  <a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">מעבר לשיחה</a>
  <p style="margin-top:20px;color:#94a3b8;font-size:12px;">ניתן לבטל קבלת התראות במייל במסך השיחות.</p>
</div>`;

  await Promise.all(
    users
      .filter((u) => u.email && claimSlot(`${u._id}:${event.conversationId}`, now))
      .map((u) =>
        sendMesergoEmail({
          to: u.email,
          subject,
          htmlBody,
          campaignName: `התראת שיחה ממתינה - ${event.conversationId}`,
        }).catch((err) => console.error('[notifications] email send failed:', u.email, err?.message || err))
      )
  );
}

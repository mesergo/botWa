/**
 * Shared Mesergo mail API sender + helpers for notification emails
 * (waiting-customer mirror, offline alert, daily summary).
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getSystemBaseUrl() {
  const raw = (process.env.SYSTEM_URL || 'https://botwa.message.co.il').trim();
  return raw.replace(/\/+$/, '');
}

/**
 * @param {{ to: string, subject: string, htmlBody: string, campaignName: string }} args
 */
export async function sendMesergoEmail({ to, subject, htmlBody, campaignName }) {
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

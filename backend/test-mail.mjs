import fetch from 'node-fetch';
const credentials = Buffer.from('admin@chatgo.live:1aa14226-ceae-4104-ba86-899eca88631d').toString('base64');
const endpoints = [
  'https://capi.mesergo.co.il/api/v2/Message/SendMessage',
  'https://capi.mesergo.co.il/api/v2/Mail/SendMail',
  'https://capi.mesergo.co.il/api/v2/Mail/Send',
  'https://capi.mesergo.co.il/api/v2/Mail/SendEmail',
];
const body = JSON.stringify({ Data: { Message: { Subject: 'Test', FromEmail: 'noreply@mesergo.co.il', ToEmail: 'go@mesergo.co.il', Body: '<p>test</p>' } } });
for (const url of endpoints) {
  try {
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Basic ${credentials}`}, body });
    const txt = await r.text();
    console.log(`[${r.status}] ${url}`);
    console.log(`  => ${txt.substring(0,300) || '(empty body)'}`);
  } catch(e) { console.log(`[ERR] ${url} => ${e.message}`); }
}

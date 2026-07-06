/**
 * Test script - run on the server to diagnose webservice connection issues
 * Usage: node test-webservice-connection.js <url>
 * Example: node test-webservice-connection.js https://api.example.com/webhook
 */

import fetch from 'node-fetch';

const url = process.argv[2];

if (!url) {
  console.log('Usage: node test-webservice-connection.js <url>');
  console.log('Example: node test-webservice-connection.js https://api.example.com/webhook');
  process.exit(1);
}

console.log('='.repeat(60));
console.log('🔍 Webservice Connection Diagnostics');
console.log('='.repeat(60));
console.log('URL:', url);
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('');

// Parse URL
try {
  const parsed = new URL(url);
  console.log('✅ URL is valid');
  console.log('   Protocol:', parsed.protocol);
  console.log('   Host:', parsed.hostname);
  console.log('   Port:', parsed.port || '(default)');
  console.log('   Path:', parsed.pathname);
  
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.startsWith('192.168.') || parsed.hostname.startsWith('10.')) {
    console.log('');
    console.log('⚠️  WARNING: URL points to a LOCAL address!');
    console.log('   This works on your local machine but NOT on a remote server!');
  }
} catch (e) {
  console.log('❌ URL is INVALID:', e.message);
  process.exit(1);
}

console.log('');
console.log('📡 Testing connection...');

const payload = {
  campaign: { id: 50000, name: "FlowBot Campaign" },
  chat: {
    created: new Date().toISOString().replace('T', ' ').split('.')[0],
    source: "FlowBot_Test",
    sender: "test",
    control: "test-node"
  },
  parameters: [],
  value: null,
  process_history: []
};

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ChatBot/1.0',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  console.log('✅ Connected successfully!');
  console.log('   Status:', response.status, response.statusText);
  console.log('   Content-Type:', response.headers.get('content-type'));
  
  const text = await response.text();
  console.log('   Response (first 500 chars):', text.substring(0, 500));

  try {
    const json = JSON.parse(text);
    console.log('');
    console.log('✅ Response is valid JSON');
    console.log('   actions count:', json.actions?.length ?? 'no actions field');
  } catch (e) {
    console.log('');
    console.log('❌ Response is NOT valid JSON - this will cause an error in the bot!');
  }

} catch (error) {
  clearTimeout(timeoutId);
  console.log('');
  
  if (error.name === 'AbortError') {
    console.log('❌ TIMEOUT - Server did not respond within 10 seconds');
    console.log('   Possible causes: firewall blocking outbound, server is down, wrong URL');
  } else if (error.code === 'ECONNREFUSED') {
    console.log('❌ ECONNREFUSED - Connection refused!');
    console.log('   The URL points to a local service that is not running on THIS server.');
    console.log('   If URL contains localhost/127.0.0.1, that is the problem.');
  } else if (error.code === 'ENOTFOUND') {
    console.log('❌ ENOTFOUND - Domain not found!');
    console.log('   DNS cannot resolve the hostname. Check the URL is correct.');
  } else if (error.code === 'CERT_HAS_EXPIRED') {
    console.log('❌ SSL Certificate has expired!');
  } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
    console.log('❌ SSL Certificate issue:', error.code);
    console.log('   The webservice uses a self-signed certificate.');
    console.log('   Fix: Use HTTP instead, or set NODE_TLS_REJECT_UNAUTHORIZED=0 (not recommended for production)');
  } else {
    console.log('❌ Error:', error.message);
    console.log('   Code:', error.code);
    console.log('   Type:', error.name);
  }
}

console.log('');
console.log('='.repeat(60));

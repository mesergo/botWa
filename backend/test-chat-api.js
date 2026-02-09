// Test file for Chat API
// Run with: node backend/test-chat-api.js

const API_BASE = 'http://localhost:3001/api';
const TOKEN = 'YOUR-TOKEN-HERE'; // Replace with actual token from add-token.js
const PHONE = '972501234567';
const SENDER = 'test-sender-12345';

async function testChatAPI() {
  console.log('🧪 Testing Chat API\n');
  console.log('⚠️  Make sure you have:');
  console.log('   1. Server running (npm start)');
  console.log('   2. Token created (node backend/add-token.js email)');
  console.log('   3. Bot created with automatic_responses node');
  console.log('   4. Updated TOKEN variable in this file\n');

  // Test 1: First message
  console.log('📤 Test 1: Sending first message...');
  try {
    const response1 = await fetch(`${API_BASE}/chat/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        phone: PHONE,
        text: 'שלום',
        sender: SENDER
      })
    });

    const data1 = await response1.json();
    console.log('✅ Response:', JSON.stringify(data1, null, 2));
    console.log('');

    if (data1.StatusId !== 1) {
      console.error('❌ Test 1 failed:', data1.StatusDescription);
      return;
    }

    // Test 2: Second message (if waiting for input)
    if (data1.control) {
      console.log('📤 Test 2: Sending second message (response to input)...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response2 = await fetch(`${API_BASE}/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          phone: PHONE,
          text: 'דני',
          sender: SENDER
        })
      });

      const data2 = await response2.json();
      console.log('✅ Response:', JSON.stringify(data2, null, 2));
      console.log('');
    }

    // Test 3: Menu selection (if menu returned)
    const hasMenu = data1.messages.some(m => m.type === 'Options');
    if (hasMenu) {
      console.log('📤 Test 3: Selecting menu option...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const firstOption = data1.messages.find(m => m.type === 'Options')?.options[0];
      if (firstOption) {
        const response3 = await fetch(`${API_BASE}/chat/respond`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
          },
          body: JSON.stringify({
            phone: PHONE,
            text: firstOption.value,
            sender: SENDER
          })
        });

        const data3 = await response3.json();
        console.log('✅ Response:', JSON.stringify(data3, null, 2));
        console.log('');
      }
    }

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Common issues:');
    console.error('  - Server not running');
    console.error('  - Invalid token');
    console.error('  - No bot configured');
    console.error('  - MongoDB not connected');
  }
}

// Check if TOKEN is set
if (TOKEN === 'YOUR-TOKEN-HERE') {
  console.error('❌ Please update TOKEN variable in this file first!');
  console.error('');
  console.error('Steps:');
  console.error('  1. Run: node backend/add-token.js your@email.com');
  console.error('  2. Copy the generated token');
  console.error('  3. Update TOKEN variable in this file');
  console.error('  4. Run: node backend/test-chat-api.js');
  process.exit(1);
}

testChatAPI();

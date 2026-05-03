/**
 * Test Script - External Message API
 * 
 * קובץ זה בודק שה-API לשליחת הודעות חיצוניות עובד כראוי
 * 
 * הרצה:
 * node backend/test-external-messages.js
 */

const API_BASE_URL = 'http://localhost:3001/api';

// ===================================
// Helper Functions
// ===================================

async function sendMessage(sessionId, message) {
  const response = await fetch(`${API_BASE_URL}/sessions/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return await response.json();
}

async function getMessages(sessionId, since = null) {
  let url = `${API_BASE_URL}/sessions/${sessionId}/messages`;
  if (since) url += `?since=${encodeURIComponent(since)}`;

  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get messages');
  }

  return await response.json();
}

async function createSession(widgetId = 'test-widget') {
  const response = await fetch(`${API_BASE_URL}/sessions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ widget_id: widgetId })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create session');
  }

  return await response.json();
}

// ===================================
// Test Cases
// ===================================

async function test1_CreateSession() {
  console.log('\n🧪 Test 1: Create Session');
  console.log('━'.repeat(50));
  
  try {
    const result = await createSession();
    console.log('✅ Session created:', result.sessionId);
    return result.sessionId;
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

async function test2_SendTextMessage(sessionId) {
  console.log('\n🧪 Test 2: Send Text Message');
  console.log('━'.repeat(50));
  
  try {
    const result = await sendMessage(sessionId, {
      content: 'זוהי הודעת בדיקה מהשרת',
      type: 'Text',
      sender: 'bot'
    });
    console.log('✅ Message sent:', result);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

async function test3_SendImageMessage(sessionId) {
  console.log('\n🧪 Test 3: Send Image Message');
  console.log('━'.repeat(50));
  
  try {
    const result = await sendMessage(sessionId, {
      content: 'הנה תמונה לדוגמה',
      type: 'Image',
      sender: 'bot',
      url: 'https://via.placeholder.com/300'
    });
    console.log('✅ Image sent:', result);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

async function test4_SendMenuMessage(sessionId) {
  console.log('\n🧪 Test 4: Send Menu Message');
  console.log('━'.repeat(50));
  
  try {
    const result = await sendMessage(sessionId, {
      content: 'בחר אפשרות:',
      type: 'Options',
      sender: 'bot',
      options: ['אפשרות 1', 'אפשרות 2', 'אפשרות 3']
    });
    console.log('✅ Menu sent:', result);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

async function test5_SendLinkMessage(sessionId) {
  console.log('\n🧪 Test 5: Send Link Message');
  console.log('━'.repeat(50));
  
  try {
    const result = await sendMessage(sessionId, {
      content: 'לחץ כאן למידע נוסף',
      type: 'URL',
      sender: 'bot',
      url: 'https://www.example.com'
    });
    console.log('✅ Link sent:', result);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

async function test6_GetMessages(sessionId) {
  console.log('\n🧪 Test 6: Get Messages');
  console.log('━'.repeat(50));
  
  try {
    const result = await getMessages(sessionId);
    console.log('✅ Messages retrieved:', result.messages.length, 'messages');
    console.log('   Has new messages:', result.hasNewMessages);
    
    // הצג את 3 ההודעות האחרונות
    const lastMessages = result.messages.slice(-3);
    console.log('\n   Last 3 messages:');
    lastMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. [${msg.sender}] ${msg.text || msg.type}`);
    });
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

async function test7_ProgressUpdates(sessionId) {
  console.log('\n🧪 Test 7: Progress Updates (Web Service Simulation)');
  console.log('━'.repeat(50));
  
  const steps = [
    { msg: '⏳ מעבד את הבקשה...', delay: 1000 },
    { msg: '🔄 מתחבר לשרת...', delay: 1500 },
    { msg: '📥 מקבל נתונים...', delay: 1000 },
    { msg: '✅ הושלם בהצלחה!', delay: 0 }
  ];

  try {
    for (const step of steps) {
      await sendMessage(sessionId, {
        content: step.msg,
        type: 'Text',
        sender: 'bot'
      });
      console.log(`   Sent: ${step.msg}`);
      
      if (step.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
      }
    }
    console.log('✅ Progress updates completed');
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

async function test8_InvalidSessionId() {
  console.log('\n🧪 Test 8: Invalid Session ID (Should Fail)');
  console.log('━'.repeat(50));
  
  try {
    await sendMessage('invalid-session-id', {
      content: 'This should fail',
      type: 'Text'
    });
    console.error('❌ Test failed: Should have thrown an error');
  } catch (error) {
    console.log('✅ Correctly rejected invalid session ID');
    console.log('   Error:', error.message);
  }
}

async function test9_MissingContent() {
  console.log('\n🧪 Test 9: Missing Content (Should Fail)');
  console.log('━'.repeat(50));
  
  try {
    const session = await createSession();
    await sendMessage(session.sessionId, {
      type: 'Text',
      sender: 'bot'
      // content is missing
    });
    console.error('❌ Test failed: Should have thrown an error');
  } catch (error) {
    console.log('✅ Correctly rejected missing content');
    console.log('   Error:', error.message);
  }
}

async function test10_PollingSince(sessionId) {
  console.log('\n🧪 Test 10: Polling with "since" parameter');
  console.log('━'.repeat(50));
  
  try {
    // קבל את כל ההודעות
    const allMessages = await getMessages(sessionId);
    const lastMessageTime = allMessages.messages.length > 0 
      ? allMessages.messages[allMessages.messages.length - 1].created
      : null;

    console.log(`   Last message time: ${lastMessageTime}`);
    
    // שלח הודעה חדשה
    await new Promise(resolve => setTimeout(resolve, 100));
    await sendMessage(sessionId, {
      content: 'הודעה חדשה אחרי timestamp',
      type: 'Text',
      sender: 'bot'
    });

    // קבל רק הודעות חדשות
    if (lastMessageTime) {
      const newMessages = await getMessages(sessionId, lastMessageTime);
      console.log('✅ New messages since last poll:', newMessages.messages.length);
      console.log('   Has new messages:', newMessages.hasNewMessages);
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// ===================================
// Main Test Runner
// ===================================

async function runAllTests() {
  console.log('\n');
  console.log('╔═════════════════════════════════════════════════╗');
  console.log('║  External Message API - Test Suite             ║');
  console.log('╚═════════════════════════════════════════════════╝');
  console.log(`\nTesting API at: ${API_BASE_URL}`);
  
  let sessionId = null;
  let passedTests = 0;
  let failedTests = 0;

  const tests = [
    { name: 'Create Session', fn: test1_CreateSession, saveResult: true },
    { name: 'Send Text Message', fn: test2_SendTextMessage },
    { name: 'Send Image Message', fn: test3_SendImageMessage },
    { name: 'Send Menu Message', fn: test4_SendMenuMessage },
    { name: 'Send Link Message', fn: test5_SendLinkMessage },
    { name: 'Get Messages', fn: test6_GetMessages },
    { name: 'Progress Updates', fn: test7_ProgressUpdates },
    { name: 'Invalid Session ID', fn: test8_InvalidSessionId },
    { name: 'Missing Content', fn: test9_MissingContent },
    { name: 'Polling with since', fn: test10_PollingSince }
  ];

  for (const test of tests) {
    try {
      if (test.saveResult) {
        sessionId = await test.fn();
      } else {
        await test.fn(sessionId);
      }
      passedTests++;
    } catch (error) {
      console.error(`\n❌ Test failed: ${test.name}`);
      console.error('   Error:', error.message);
      failedTests++;
    }
  }

  // סיכום
  console.log('\n');
  console.log('╔═════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                   ║');
  console.log('╚═════════════════════════════════════════════════╝');
  console.log(`\n✅ Passed: ${passedTests}/${tests.length}`);
  console.log(`❌ Failed: ${failedTests}/${tests.length}`);
  
  if (sessionId) {
    console.log(`\n📝 Session ID for manual testing: ${sessionId}`);
    console.log('\nYou can now open the simulator and see the messages!');
  }

  console.log('\n');
}

// הרצת הבדיקות
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('Tests completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = {
  sendMessage,
  getMessages,
  createSession,
  runAllTests
};

/**
 * בדיקת פורמט התגובות מה-API
 * בודק שכל סוג תגובה מוחזר בפורמט הנכון עם אותיות גדולות/קטנות מדויקות
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_TOKEN = process.env.TEST_TOKEN; // נשים את הטוקן שלך ב-.env
const TEST_PHONE = '972504200742';
const TEST_SENDER = '972504200742';

// פונקציה לבדיקת הפורמט המדויק
function validateResponseFormat(response) {
  console.log('\n========== בדיקת פורמט התגובה ==========\n');
  
  // בדיקת שדות ראשיים
  const requiredFields = ['StatusId', 'StatusDescription', 'sender', 'messages'];
  const missingFields = requiredFields.filter(field => !(field in response));
  
  if (missingFields.length > 0) {
    console.error('❌ שדות חסרים:', missingFields);
    return false;
  }
  
  console.log('✅ כל השדות הראשיים קיימים');
  
  // בדיקת סוג השדות
  console.log('\nבדיקת סוגי השדות:');
  console.log('StatusId:', typeof response.StatusId, '=', response.StatusId);
  console.log('StatusDescription:', typeof response.StatusDescription, '=', response.StatusDescription);
  console.log('sender:', typeof response.sender, '=', response.sender);
  console.log('messages:', Array.isArray(response.messages) ? 'Array' : typeof response.messages);
  
  // בדיקת אותיות גדולות/קטנות
  const fieldNameTests = {
    'StatusId': response.hasOwnProperty('StatusId') && !response.hasOwnProperty('statusId'),
    'StatusDescription': response.hasOwnProperty('StatusDescription') && !response.hasOwnProperty('statusDescription'),
    'sender': response.hasOwnProperty('sender') && !response.hasOwnProperty('Sender'),
    'messages': response.hasOwnProperty('messages') && !response.hasOwnProperty('Messages')
  };
  
  console.log('\nבדיקת אותיות גדולות/קטנות:');
  for (const [field, isCorrect] of Object.entries(fieldNameTests)) {
    if (isCorrect) {
      console.log(`✅ ${field} - אותיות נכונות`);
    } else {
      console.log(`❌ ${field} - אותיות שגויות!`);
    }
  }
  
  // בדיקת כל מסר במערך messages
  if (Array.isArray(response.messages)) {
    console.log(`\nבדיקת ${response.messages.length} מסרים:`);
    
    response.messages.forEach((msg, idx) => {
      console.log(`\n--- מסר #${idx + 1} ---`);
      console.log('type:', msg.type);
      
      if (msg.type === 'Text') {
        validateTextMessage(msg);
      } else if (msg.type === 'Options') {
        validateOptionsMessage(msg);
      } else if (msg.type === 'Image') {
        validateImageMessage(msg);
      } else if (msg.type === 'URL') {
        validateUrlMessage(msg);
      }
      
      // בדיקת שדה created
      if (msg.created) {
        console.log('✅ created:', msg.created);
      } else {
        console.log('❌ שדה created חסר!');
      }
    });
  }
  
  // בדיקת שדה control (אם קיים)
  if (response.control) {
    console.log('\n--- שדה control ---');
    console.log('type:', response.control.type);
    console.log('name:', response.control.name);
    
    if (response.control.type === 'InputText') {
      console.log('✅ control.type = InputText (אותיות נכונות)');
    } else {
      console.log('❌ control.type שגוי:', response.control.type);
    }
  }
  
  console.log('\n========================================\n');
  return true;
}

function validateTextMessage(msg) {
  console.log('סוג: Text');
  
  // בדיקת שדות נדרשים
  if (!msg.text) {
    console.log('❌ שדה text חסר!');
  } else {
    console.log('✅ text:', msg.text.substring(0, 50) + '...');
  }
  
  // בדיקה שאין שדה options במסר טקסט
  if (msg.options) {
    console.log('❌ שדה options לא צריך להיות במסר Text!');
  } else {
    console.log('✅ אין שדה options (נכון)');
  }
}

function validateOptionsMessage(msg) {
  console.log('סוג: Options');
  
  // בדיקה שאין שדה text במסר אופציות
  if (msg.text) {
    console.log('❌ שדה text לא צריך להיות במסר Options!');
    console.log('   הטקסט צריך להיות במסר Text נפרד לפניו');
  } else {
    console.log('✅ אין שדה text (נכון)');
  }
  
  // בדיקת שדה options
  if (!msg.options) {
    console.log('❌ שדה options חסר!');
  } else if (!Array.isArray(msg.options)) {
    console.log('❌ options לא מערך!');
  } else {
    console.log('✅ options:', msg.options.length, 'אפשרויות');
    
    // בדיקת כל אפשרות
    msg.options.forEach((opt, idx) => {
      if (opt.label && opt.value) {
        console.log(`  ${idx + 1}. label: "${opt.label}", value: "${opt.value}"`);
        if (opt.image_url) {
          console.log(`     image_url: ${opt.image_url}`);
        }
      } else {
        console.log(`  ❌ אפשרות ${idx + 1} חסרה label או value`);
      }
    });
  }
}

function validateImageMessage(msg) {
  console.log('סוג: Image');
  
  if (!msg.url) {
    console.log('❌ שדה url חסר!');
  } else {
    console.log('✅ url:', msg.url);
  }
}

function validateUrlMessage(msg) {
  console.log('סוג: URL');
  
  if (!msg.url) {
    console.log('❌ שדה url חסר!');
  } else {
    console.log('✅ url:', msg.url);
  }
  
  if (!msg.text) {
    console.log('❌ שדה text חסר!');
  } else {
    console.log('✅ text:', msg.text);
  }
}

// פונקציה לשליחת בקשה ובדיקת התגובה
async function testChatAPI(phone, text) {
  console.log(`\n📤 שולח בקשה: phone=${phone}, text="${text}"`);
  
  try {
    const response = await fetch(`${API_URL}/api/chat/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({
        phone,
        text,
        sender: TEST_SENDER
      })
    });
    
    const data = await response.json();
    
    console.log('\n📥 התגובה המלאה:');
    console.log(JSON.stringify(data, null, 2));
    
    validateResponseFormat(data);
    
    return data;
  } catch (error) {
    console.error('❌ שגיאה בבקשה:', error.message);
    return null;
  }
}

// הרצת הבדיקות
async function runTests() {
  if (!TEST_TOKEN) {
    console.error('❌ חסר TEST_TOKEN ב-.env!');
    console.log('\nהוסף לקובץ .env:');
    console.log('TEST_TOKEN=your_token_here');
    return;
  }
  
  console.log('🚀 מתחיל בדיקות פורמט API\n');
  console.log('API URL:', API_URL);
  console.log('Phone:', TEST_PHONE);
  
  // בדיקה 1: התחלת שיחה חדשה (אמור להחזיר טקסט + אופציות)
  console.log('\n\n═══════════════════════════════════════');
  console.log('בדיקה 1: התחלת שיחה חדשה');
  console.log('═══════════════════════════════════════');
  await testChatAPI(TEST_PHONE, 'שלום');
  
  // המתן 2 שניות
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // בדיקה 2: בחירה מתפריט
  console.log('\n\n═══════════════════════════════════════');
  console.log('בדיקה 2: בחירה מתפריט');
  console.log('═══════════════════════════════════════');
  await testChatAPI(TEST_PHONE, 'אפשרות 1');
  
  console.log('\n\n✅ הבדיקות הסתיימו!');
}

runTests();

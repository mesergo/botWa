/**
 * דוגמה לשליחת הודעות חיצוניות לסימולטור
 * ניתן להשתמש בקובץ זה כבסיס לשילוב עם פרויקטים חיצוניים
 */

// ============================================
// 1. הגדרות בסיסיות
// ============================================

const API_BASE_URL = 'http://localhost:3001/api'; // שנה לכתובת השרת שלך
// const API_BASE_URL = 'https://botswa.message.co.il/api'; // לסביבת production

// ============================================
// 2. פונקציות שירות
// ============================================

/**
 * שליחת הודעה לסשן פעיל
 * @param {string} sessionId - מזהה הסשן
 * @param {Object} message - אובייקט ההודעה
 * @param {string} simulatorId - (אופציונלי) מזהה סימולטור ספציפי
 * @returns {Promise<Object>} - תוצאה
 */
async function sendMessageToSimulator(sessionId, message, simulatorId = null) {
  try {
    const body = {
      sessionId,
      message
    };
    
    // הוסף simulator_id אם סופק - הודעה תשלח רק לסימולטור זה
    if (simulatorId) {
      body.simulator_id = simulatorId;
    }
    
    const response = await fetch(`${API_BASE_URL}/sessions/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return await response.json();
  } catch (error) {
    console.error('[sendMessageToSimulator] Error:', error);
    throw error;
  }
}

/**
 * שליחת הודעת טקסט פשוטה
 */
async function sendTextMessage(sessionId, text, simulatorId = null) {
  return sendMessageToSimulator(sessionId, {
    content: text,
    type: 'Text',
    sender: 'bot'
  }, simulatorId);
}

/**
 * שליחת תמונה
 */
async function sendImageMessage(sessionId, imageUrl, caption = '') {
  return sendMessageToSimulator(sessionId, {
    content: caption,
    type: 'Image',
    sender: 'bot',
    url: imageUrl
  });
}

/**
 * שליחת תפריט אפשרויות
 */
async function sendMenuMessage(sessionId, text, options) {
  return sendMessageToSimulator(sessionId, {
    content: text,
    type: 'Options',
    sender: 'bot',
    options
  });
}

/**
 * שליחת קישור
 */
async function sendLinkMessage(sessionId, text, url) {
  return sendMessageToSimulator(sessionId, {
    content: text,
    type: 'URL',
    sender: 'bot',
    url
  });
}

// ============================================
// 3. דוגמאות שימוש
// ============================================

/**
 * פונקציה מתקדמת: עיבוד תשובת Web Service ושליחת המשך התסריט
 * ממירה תגובה מ-web service לפורמט WhatsApp ושולחת את כל ההודעות בסדר
 * 
 * @param {string} sessionId - מזהה הסשן
 * @param {Object} webServiceResponse - תגובה מה-web service
 * @param {Array} webServiceResponse.actions - רשימת פעולות לביצוע
 * @param {string} simulatorId - (אופציונלי) מזהה סימולטור ספציפי
 * @returns {Promise<Object>} תוצאת השליחה
 * 
 * דוגמת תגובה מה-web service:
 * {
 *   actions: [
 *     { type: 'SendMessage', text: 'ההזמנה התקבלה בהצלחה!' },
 *     { type: 'SendImage', url: 'https://example.com/receipt.jpg' },
 *     { type: 'InputText', text: 'האם תרצה להוסיף עוד משהו?', options: ['כן', 'לא'] },
 *     { type: 'SetParameter', name: 'orderStatus', value: 'confirmed' }
 *   ]
 * }
 */
async function processWebServiceResponse(sessionId, webServiceResponse, simulatorId = null) {
  try {
    const actions = webServiceResponse.actions || [];
    console.log(`[processWebServiceResponse] Processing ${actions.length} actions for session ${sessionId}`);

    for (const action of actions) {
      const actionType = action.type;
      console.log('[processWebServiceResponse] Processing action:', actionType);

      switch (actionType) {
        case 'SendMessage':
          // שליחת הודעת טקסט
          if (action.text && action.text.trim()) {
            await sendTextMessage(sessionId, action.text, simulatorId);
            await delay(300); // המתנה קצרה בין הודעות
          }
          break;

        case 'SendImage':
          // שליחת תמונה
          if (action.url) {
            await sendImageMessage(sessionId, action.url, action.text || '', simulatorId);
            await delay(300);
          }
          break;

        case 'SendVideo':
          // שליחת סרטון
          if (action.url) {
            await sendMessageToSimulator(sessionId, {
              content: action.text || '',
              type: 'Video',
              sender: 'bot',
              url: action.url
            }, simulatorId);
            await delay(300);
          }
          break;

        case 'SendDocument':
          // שליחת מסמך
          if (action.url) {
            await sendMessageToSimulator(sessionId, {
              content: action.text || '',
              type: 'Document',
              sender: 'bot',
              url: action.url
            }, simulatorId);
            await delay(300);
          }
          break;

        case 'SendWebpage':
          // שליחת קישור
          if (action.url) {
            await sendLinkMessage(sessionId, action.text || 'לחץ כאן', action.url, simulatorId);
            await delay(300);
          }
          break;

        case 'InputText':
          // שליחת תפריט או בקשת קלט
          if (action.options && action.options.length > 0) {
            // יש אפשרויות - שלח כתפריט
            const optionsList = action.options.map(opt => {
              if (typeof opt === 'string') return opt;
              return opt.label || opt.text || opt.value || String(opt);
            });

            // שלח את הטקסט (אם יש) ואז את התפריט
            if (action.text && action.text.trim()) {
              await sendTextMessage(sessionId, action.text, simulatorId);
              await delay(200);
            }

            await sendMenuMessage(sessionId, '', optionsList, simulatorId);
          } else if (action.text) {
            // אין אפשרויות - רק טקסט
            await sendTextMessage(sessionId, action.text, simulatorId);
          }
          break;

        case 'SendItem':
          // שליחת פריט בקרוסלה (לא מומש כרגע - ניתן להוסיף)
          console.log('[processWebServiceResponse] SendItem not yet implemented for external API');
          break;

        case 'SetParameter':
          // הגדרת פרמטר (נשמר ב-session)
          console.log(`[processWebServiceResponse] SetParameter: ${action.name} = ${action.value}`);
          // ניתן להוסיף שמירה של הפרמטר באמצעות API נוסף אם נדרש
          break;

        case 'Return':
          // ערך חזרה (בדרך כלל משמש להחלטות בתוך הבוט)
          console.log('[processWebServiceResponse] Return value:', action.value);
          break;

        case 'Goto':
          // מעבר לתווית אחרת (לא רלוונטי ל-API חיצוני)
          console.log('[processWebServiceResponse] Goto not applicable for external API');
          break;

        case 'ChangeState':
          // שינוי מצב הבוט
          console.log(`[processWebServiceResponse] ChangeState to: ${action.value}`);
          break;

        default:
          console.log(`[processWebServiceResponse] Unknown action type: ${actionType}`);
      }
    }

    console.log('[processWebServiceResponse] All actions processed successfully');
    return { success: true, actionsProcessed: actions.length };

  } catch (error) {
    console.error('[processWebServiceResponse] Error:', error);
    
    // שליחת הודעת שגיאה לסימולטור
    try {
      await sendTextMessage(sessionId, '❌ אירעה שגיאה בעיבוד התשובה מהשרת', simulatorId);
    } catch (sendError) {
      console.error('[processWebServiceResponse] Failed to send error message:', sendError);
    }
    
    throw error;
  }
}

/**
 * פונקציית עזר: המתנה
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * פונקציה מעודכנת: שליחת תפריט עם תמיכה ב-simulatorId
 */
async function sendMenuMessage(sessionId, text, options, simulatorId = null) {
  return sendMessageToSimulator(sessionId, {
    content: text,
    type: 'Options',
    sender: 'bot',
    options
  }, simulatorId);
}

/**
 * דוגמה 1: שליחת תשובה מ-Web Service (גרסה פשוטה)
 */
async function exampleWebServiceResponse(sessionId) {
  try {
    // סימולציה של קריאה ל-web service
    console.log('קורא ל-web service...');
    
    const webServiceData = await fetch('https://api.example.com/data')
      .then(res => res.json());
    
    // שליחת התוצאה לסימולטור
    await sendTextMessage(
      sessionId,
      `התקבלה תשובה מהשרת: ${webServiceData.result}`
    );
    
    console.log('הודעה נשלחה בהצלחה!');
  } catch (error) {
    console.error('שגיאה:', error);
    
    // שליחת הודעת שגיאה לסימולטור
    await sendTextMessage(
      sessionId,
      '❌ אירעה שגיאה בעיבוד הבקשה'
    );
  }
}

/**
 * דוגמה 1.5: שימוש ב-processWebServiceResponse (גרסה מתקדמת)
 */
async function exampleAdvancedWebServiceResponse(sessionId) {
  try {
    console.log('קורא ל-web service...');
    
    // סימולציה של תגובה מ-web service
    const webServiceResponse = {
      actions: [
        { type: 'SendMessage', text: '⏳ מעבד את הבקשה...' },
        { type: 'SetParameter', name: 'requestStatus', value: 'processing' },
        { type: 'SendMessage', text: '✅ הבקשה עובדה בהצלחה!' },
        { type: 'SendMessage', text: 'הנה הפרטים:' },
        { type: 'SendImage', url: 'https://example.com/result.jpg', text: 'תוצאת העיבוד' },
        { type: 'InputText', text: 'מה תרצה לעשות כעת?', options: ['בקשה חדשה', 'צפייה בהיסטוריה', 'יציאה'] }
      ]
    };
    
    // עיבוד ושליחת כל ההודעות
    await processWebServiceResponse(sessionId, webServiceResponse);
    
    console.log('כל ההודעות נשלחו בהצלחה!');
  } catch (error) {
    console.error('שגיאה:', error);
  }
}

/**
 * דוגמה 2: תהליך עיבוד ארוך עם עדכוני סטטוס
 */
async function exampleLongProcess(sessionId) {
  try {
    // שלב 1
    await sendTextMessage(sessionId, '⏳ מעבד את הבקשה...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // שלב 2
    await sendTextMessage(sessionId, '🔄 מתחבר לשרת...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // שלב 3
    await sendTextMessage(sessionId, '✅ הבקשה עובדה בהצלחה!');
    
    // שליחת תוצאה
    await sendMenuMessage(
      sessionId,
      'מה תרצה לעשות כעת?',
      ['בקשה חדשה', 'צפייה בהיסטוריה', 'יציאה']
    );
  } catch (error) {
    console.error('שגיאה:', error);
  }
}

/**
 * דוגמה 3: שליחת תוצאות חיפוש עם תמונות
 */
async function exampleSearchResults(sessionId, query) {
  try {
    await sendTextMessage(sessionId, `🔍 מחפש: "${query}"...`);
    
    // סימולציה של חיפוש
    const results = [
      {
        title: 'תוצאה 1',
        image: 'https://via.placeholder.com/300',
        description: 'תיאור תוצאה 1'
      },
      {
        title: 'תוצאה 2',
        image: 'https://via.placeholder.com/300',
        description: 'תיאור תוצאה 2'
      }
    ];
    
    // שליחת התוצאות
    for (const result of results) {
      await sendImageMessage(
        sessionId,
        result.image,
        `${result.title}\n${result.description}`
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    await sendTextMessage(sessionId, `נמצאו ${results.length} תוצאות`);
  } catch (error) {
    console.error('שגיאה:', error);
  }
}

/**
 * דוגמה 4: שילוב עם webhook מחיצוני
 */
async function handleWebhook(webhookData) {
  const { sessionId, action, data } = webhookData;
  
  try {
    switch (action) {
      case 'payment_completed':
        await sendTextMessage(
          sessionId,
          `✅ התשלום בסך ${data.amount}₪ בוצע בהצלחה!`
        );
        break;
        
      case 'order_shipped':
        await sendTextMessage(
          sessionId,
          `📦 ההזמנה שלך נשלחה!\nמספר מעקב: ${data.trackingNumber}`
        );
        await sendLinkMessage(
          sessionId,
          'לחץ כאן למעקב אחר המשלוח',
          data.trackingUrl
        );
        break;
        
      case 'reminder':
        await sendTextMessage(
          sessionId,
          `⏰ תזכורת: ${data.message}`
        );
        break;
        
      default:
        await sendTextMessage(
          sessionId,
          `📬 התקבלה הודעה חדשה מהמערכת`
        );
    }
  } catch (error) {
    console.error('שגיאה בטיפול ב-webhook:', error);
  }
}

/**
 * דוגמה 5: עיבוד נתונים מ-Filament
 */
class FilamentBotIntegration {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
  }
  
  async sendMessage(sessionId, message) {
    return sendMessageToSimulator(sessionId, message);
  }
  
  async processFormSubmission(sessionId, formData) {
    try {
      // שליחת התחלת עיבוד
      await this.sendMessage(sessionId, {
        content: '⏳ מעבד את הטופס...',
        type: 'Text',
        sender: 'bot'
      });
      
      // עיבוד הנתונים (לדוגמה: שמירה ב-DB)
      await this.saveToDatabase(formData);
      
      // שליחת אישור
      await this.sendMessage(sessionId, {
        content: '✅ הטופס נשמר בהצלחה!',
        type: 'Text',
        sender: 'bot'
      });
      
      // שליחת אפשרויות המשך
      await this.sendMessage(sessionId, {
        content: 'מה תרצה לעשות עכשיו?',
        type: 'Options',
        sender: 'bot',
        options: ['שלח טופס נוסף', 'צפה בטפסים שנשלחו', 'חזור לתפריט']
      });
      
    } catch (error) {
      console.error('שגיאה בעיבוד טופס:', error);
      await this.sendMessage(sessionId, {
        content: '❌ אירעה שגיאה בשמירת הטופס',
        type: 'Text',
        sender: 'bot'
      });
    }
  }
  
  async saveToDatabase(data) {
    // דוגמה - החלף עם הלוגיקה שלך
    return new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// ============================================
// 4. שימוש בדוגמאות
// ============================================

// הרץ דוגמה מסוימת
async function runExample() {
  const sessionId = '67890abcdef12345'; // שנה למזהה סשן אמיתי
  
  // בחר דוגמה להפעלה:
  
  // await exampleWebServiceResponse(sessionId);
  // await exampleAdvancedWebServiceResponse(sessionId);  // גרסה מתקדמת!
  // await exampleLongProcess(sessionId);
  // await exampleSearchResults(sessionId, 'חיפוש לדוגמה');
  
  // או השתמש ב-webhook:
  // await handleWebhook({
  //   sessionId,
  //   action: 'payment_completed',
  //   data: { amount: 150 }
  // });
  
  // או Filament:
  // const filament = new FilamentBotIntegration(API_BASE_URL);
  // await filament.processFormSubmission(sessionId, {
  //   name: 'ישראל ישראלי',
  //   email: 'israel@example.com'
  // });
}

// ============================================
// 5. ייצוא לשימוש במודולים אחרים
// ============================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendMessageToSimulator,
    sendTextMessage,
    sendImageMessage,
    sendMenuMessage,
    sendLinkMessage,
    processWebServiceResponse,  // *** הפונקציה החדשה המתקדמת! ***
    exampleWebServiceResponse,
    exampleAdvancedWebServiceResponse,
    exampleLongProcess,
    exampleSearchResults,
    handleWebhook,
    FilamentBotIntegration
  };
}

// הערה: אם אתה משתמש ב-Node.js, אל תשכח להתקין node-fetch:
// npm install node-fetch
// ואז:
// const fetch = require('node-fetch');

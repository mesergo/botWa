# מדריך שליחת הודעות חיצוניות לסימולטור

## תיאור
API זה מאפשר לשלוח הודעות מפרויקטים חיצוניים (כמו Filament או מערכות אחרות) לסשן פעיל בסימולטור.
ההודעות יופיעו בזמן אמת בממשק הסימולטור באמצעות מנגנון polling.

## 1. שליחת הודעה לסשן

### Endpoint
```
POST /api/sessions/send-message
```

### Headers
```json
{
  "Content-Type": "application/json"
}
```

### Body Parameters
| שם | סוג | חובה | תיאור |
|---|---|---|---|
| sessionId | string | כן | מזהה הסשן (ObjectId) |
| message | object | כן | אובייקט ההודעה |
| message.content | string | כן | תוכן ההודעה |
| message.type | string | לא | סוג ההודעה (Text/Image/Video/Document/URL/Options) |
| message.sender | string | לא | שולח ההודעה (bot/user), ברירת מחדל: bot |
| message.url | string | לא | URL לתמונה/סרטון/מסמך |
| message.options | array | לא | רשימת אפשרויות לתפריט |

### דוגמה - שליחת הודעת טקסט פשוטה
```javascript
const response = await fetch('http://your-domain.com/api/sessions/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: '507f1f77bcf86cd799439011',
    message: {
      content: 'התקבלה תשובה מהשרת!',
      type: 'Text',
      sender: 'bot'
    }
  })
});

const result = await response.json();
console.log(result); // { success: true, message: 'Message added to session' }
```

### דוגמה - שליחת תמונה
```javascript
await fetch('http://your-domain.com/api/sessions/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: '507f1f77bcf86cd799439011',
    message: {
      content: 'הנה התמונה שביקשת',
      type: 'Image',
      sender: 'bot',
      url: 'https://example.com/image.jpg'
    }
  })
});
```

### דוגמה - שליחת תפריט אפשרויות
```javascript
await fetch('http://your-domain.com/api/sessions/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: '507f1f77bcf86cd799439011',
    message: {
      content: 'בחר אפשרות:',
      type: 'Options',
      sender: 'bot',
      options: ['אפשרות 1', 'אפשרות 2', 'אפשרות 3']
    }
  })
});
```

## 2. קבלת הודעות חדשות (Polling)

הסימולטור מבצע polling אוטומטי כל 3 שניות כדי לבדוק הודעות חדשות.

### Endpoint
```
GET /api/sessions/:sessionId/messages?since=<timestamp>
```

### Parameters
| שם | סוג | חובה | תיאור |
|---|---|---|---|
| sessionId | string | כן | מזהה הסשן (בpath) |
| since | string | לא | ISO timestamp - החזר רק הודעות חדשות מאז |

### Response
```json
{
  "success": true,
  "hasNewMessages": true,
  "messages": [
    {
      "type": "Text",
      "sender": "bot",
      "name": "בוט",
      "text": "התקבלה תשובה מהשרת!",
      "created": "2024-01-15T10:30:00.000Z",
      "isExternal": true
    }
  ]
}
```

## 3. שימוש עם Web Service

כאשר חוזרת תשובה מ-web service, ניתן לשלוח אותה לסשן הפעיל:

```javascript
// לאחר קבלת תשובה מ-web service
const webServiceResponse = await callWebService();

// שליחת התשובה לסימולטור
await fetch('http://your-domain.com/api/sessions/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: currentSessionId, // שמור את ה-sessionId בעת יצירת הסשן
    message: {
      content: `התקבלה תשובה: ${webServiceResponse.data}`,
      type: 'Text',
      sender: 'bot'
    }
  })
});
```

## 4. שילוב עם Filament

### דוגמה לשליחה מ-Filament (PHP)

```php
<?php

use Illuminate\Support\Facades\Http;

class BotMessageService
{
    private $apiUrl = 'http://your-domain.com/api/sessions';
    
    public function sendMessage($sessionId, $content, $type = 'Text', $sender = 'bot')
    {
        $response = Http::post("{$this->apiUrl}/send-message", [
            'sessionId' => $sessionId,
            'message' => [
                'content' => $content,
                'type' => $type,
                'sender' => $sender
            ]
        ]);
        
        return $response->json();
    }
    
    public function sendWebServiceResponse($sessionId, $data)
    {
        return $this->sendMessage(
            $sessionId,
            "התקבלה תשובה מהשרת: {$data}",
            'Text',
            'bot'
        );
    }
}

// שימוש
$botService = new BotMessageService();
$botService->sendWebServiceResponse('507f1f77bcf86cd799439011', 'הנתונים עודכנו בהצלחה');
```

## 5. קבלת Session ID

כדי לשלוח הודעות, צריך את ה-sessionId. ניתן לקבל אותו:

1. **מהסימולטור** - ה-sessionId נוצר אוטומטית בעת פתיחת הסימולטור
2. **מ-API קיים** - עם קריאה ל-`/api/sessions/start` מתקבל sessionId

```javascript
// דוגמה ליצירת סשן חדש
const response = await fetch('http://your-domain.com/api/sessions/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    widget_id: 'your-widget-id',
    customer_phone: 'optional-phone'
  })
});

const { sessionId } = await response.json();
console.log('Session ID:', sessionId);
```

## 6. טיפים ושימושים נפוצים

### המתנה לתשובה מ-Web Service
```javascript
// 1. שמור את sessionId כשהמשתמש מתחיל שיחה
const sessionId = currentSessionId;

// 2. קרא ל-web service
const result = await fetch('https://external-api.com/process', {
  method: 'POST',
  body: JSON.stringify({ data: userInput })
});

// 3. שלח את התוצאה לסימולטור
await fetch('http://your-domain.com/api/sessions/send-message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: sessionId,
    message: {
      content: `התקבלה תשובה: ${result.message}`,
      type: 'Text'
    }
  })
});
```

### שליחת עדכונים מרובים
```javascript
// שליחת מספר הודעות ברצף
const messages = [
  'מעבד את הבקשה...',
  'מחבר לשרת...',
  'התקבלה תשובה!'
];

for (const msg of messages) {
  await fetch('http://your-domain.com/api/sessions/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: sessionId,
      message: { content: msg, type: 'Text' }
    })
  });
  
  // המתן קצת בין הודעות
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## 7. טיפול בשגיאות

```javascript
try {
  const response = await fetch('http://your-domain.com/api/sessions/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: sessionId,
      message: { content: 'הודעה', type: 'Text' }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('שגיאה בשליחת הודעה:', error);
    // טיפול בשגיאה...
  }
  
  const result = await response.json();
  console.log('הודעה נשלחה בהצלחה:', result);
  
} catch (error) {
  console.error('שגיאת רשת:', error);
}
```

## 8. הערות חשובות

1. **Polling Interval** - הסימולטור בודק הודעות חדשות כל 3 שניות
2. **Session Active** - ודא שהסשן פעיל (is_active: true) לפני שליחת הודעות
3. **Message History** - כל ההודעות נשמרות ב-process_history של הסשן
4. **External Flag** - הודעות חיצוניות מסומנות עם `isExternal: true`
5. **Timestamp** - השתמש ב-timestamp של ההודעה האחרונה לpolling יעיל

## תמיכה ובעיות

אם נתקלת בבעיות או יש שאלות, בדוק את:
- Console logs בדפדפן (F12)
- Server logs ב-backend
- מבנה ה-sessionId (חייב להיות ObjectId תקין)

# קריאת API לשליחת הודעות חיצוניות - סיכום מהיר

## מה נוסף?

נוספה יכולת לשלוח הודעות מפרויקטים חיצוניים (כמו Filament) לסימולטור, והודעות יופיעו בזמן אמת.

## קבצים שנוצרו/עודכנו

### Backend
1. **`backend/controllers/sessionController.js`**
   - ✅ `sendExternalMessage()` - קבלת הודעות מחיצונית
   - ✅ `getSessionMessages()` - קבלת הודעות חדשות (לpolling)

2. **`backend/routes/sessionRoutes.js`**
   - ✅ `POST /api/sessions/send-message` - שליחת הודעה חיצונית
   - ✅ `GET /api/sessions/:sessionId/messages` - קבלת הודעות חדשות

### Frontend
3. **`frontend/components/Simulator.tsx`**
   - ✅ מנגנון polling כל 3 שניות
   - ✅ הצגת הודעות חיצוניות אוטומטית
   - ✅ מעקב אחרי timestamp של הודעות

### תיעוד
4. **`EXTERNAL-MESSAGE-API.md`** - מדריך מפורט בעברית
5. **`backend/examples/external-message-example.js`** - דוגמאות JavaScript
6. **`backend/examples/filament-integration-example.php`** - דוגמאות PHP/Filament

## איך להשתמש?

### שליחת הודעה פשוטה (JavaScript)
```javascript
await fetch('http://localhost:3001/api/sessions/send-message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'SESSION_ID_HERE',
    message: {
      content: 'הודעה מהשרת!',
      type: 'Text',
      sender: 'bot'
    }
  })
});
```

### שליחת הודעה מ-PHP (Filament)
```php
use Illuminate\Support\Facades\Http;

Http::post('http://localhost:3001/api/sessions/send-message', [
    'sessionId' => $sessionId,
    'message' => [
        'content' => 'הודעה מהשרת!',
        'type' => 'Text',
        'sender' => 'bot'
    ]
]);
```

## תכונות

✅ **Polling אוטומטי** - הסימולטור בודק הודעות חדשות כל 3 שניות  
✅ **זמן אמת** - הודעות מופיעות מיד בסימולטור  
✅ **סוגי הודעות** - תמיכה בטקסט, תמונות, סרטונים, מסמכים, קישורים, תפריטים  
✅ **Web Service** - מושלם לתשובות מ-web services  
✅ **היסטוריה** - כל ההודעות נשמרות ב-process_history  

## דוגמאות שימוש

### 1. תשובה מ-Web Service
```javascript
// אחרי קריאה ל-web service
const result = await callExternalAPI();

await sendMessage(sessionId, {
  content: `תשובה מהשרת: ${result.data}`,
  type: 'Text'
});
```

### 2. עדכוני התקדמות
```javascript
await sendMessage(sessionId, { content: '⏳ מעבד...' });
await processData();

await sendMessage(sessionId, { content: '✅ הושלם!' });
```

### 3. שליחת תמונה
```javascript
await sendMessage(sessionId, {
  content: 'הנה התמונה',
  type: 'Image',
  url: 'https://example.com/image.jpg'
});
```

### 4. תפריט אפשרויות
```javascript
await sendMessage(sessionId, {
  content: 'בחר אפשרות:',
  type: 'Options',
  options: ['אפשרות 1', 'אפשרות 2', 'אפשרות 3']
});
```

## איך לקבל את ה-sessionId?

1. **מהסימולטור** - נוצר אוטומטית בפתיחה
2. **מה-API** - בזמן יצירת סשן חדש:
```javascript
const response = await fetch('http://localhost:3001/api/sessions/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ widget_id: 'YOUR_WIDGET_ID' })
});

const { sessionId } = await response.json();
```

## טיפים

- 💡 שמור את ה-sessionId כשמתחילים שיחה
- 💡 ודא שהסשן פעיל לפני שליחה
- 💡 השתמש בpolling interval של 3 שניות (ברירת מחדל)
- 💡 כל ההודעות מסומנות עם `isExternal: true`

## קישורים למסמכים

- 📖 [מדריך מפורט](EXTERNAL-MESSAGE-API.md)
- 💻 [דוגמאות JavaScript](backend/examples/external-message-example.js)
- 🐘 [דוגמאות PHP/Filament](backend/examples/filament-integration-example.php)

## תמיכה

אם יש בעיות:
1. בדוק console logs (F12 בדפדפן)
2. בדוק server logs
3. ודא שה-sessionId תקין (ObjectId)
4. ודא שהסשן פעיל

---

**נוצר בתאריך:** 21/04/2026  
**גרסה:** 1.0.0

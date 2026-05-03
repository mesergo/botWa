# מזהה סימולטור - Simulator ID

## סקירה

כל סימולטור שנפתח מקבל מזהה ייחודי (Simulator ID) שמאפשר לשלוח הודעות ספציפית לסימולטור זה בלבד.

## מזהה הסימולטור

### יצירת המזהה
המזהה נוצר אוטומטית בעת פתיחת הסימולטור:
```javascript
const simulatorId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// דוגמה: sim-1713702000000-a3b9x2z1k
```

### שמירה בסשן
המזהה נשמר בשני מקומות:
1. **כשדה ברמת הסשן** - `simulator_id` (לסינון מהיר)
2. **בפרמטרים** - `parameters._simulatorId` (גישה מהסימולטור)

## שימושים

### 1. שליחה לסימולטור ספציפי
```javascript
await fetch('http://localhost:3001/api/sessions/send-message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'SESSION_ID',
    simulator_id: 'sim-1713702000000-a3b9x2z1k', // שלח לסימולטור זה בלבד
    message: {
      content: 'הודעה ספציפית',
      type: 'Text'
    }
  })
});
```

### 2. שליחה לכל הסימולטורים (Broadcast)
```javascript
await fetch('http://localhost:3001/api/sessions/send-message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'SESSION_ID',
    // אל תצרף simulator_id - ההודעה תשלח לכל הסימולטורים
    message: {
      content: 'הודעה לכולם',
      type: 'Text'
    }
  })
});
```

### 3. קבלת מזהה הסימולטור

#### מהפרונטאנד (בתוך הסימולטור)
```typescript
// המזהה זמין בפרמטרים
const simulatorId = sessionParameters._simulatorId;
console.log('Simulator ID:', simulatorId);
```

#### מה-API
```javascript
// קבל את הסשן
const response = await fetch(`http://localhost:3001/api/sessions/${sessionId}/messages`);
const data = await response.json();

// המזהה נמצא בפרמטרים של הסשן
// או שאל את המשתמש לספק את המזהה
```

## מתי להשתמש במזהה סימולטור?

### ✅ מתאים ל:
- **סימולטורים מרובים** - כאשר מספר משתמשים בודקים את אותו הבוט
- **הודעות ממוקדות** - כאשר רוצים לשלוח הודעה למשתמש ספציפי
- **בדיקות** - כאשר מפתח רוצה לראות רק הודעות שמיועדות לו
- **Web Service תגובות** - כאשר כל סימולטור מבצע קריאה משלו

### ⭕ לא חובה ב:
- **סימולטור יחיד** - כאשר רק משתמש אחד משתמש בבוט
- **Broadcast הודעות** - כאשר רוצים שכולם יראו את ההודעה
- **הודעות מהבוט** - הודעות רגילות מהבוט לא דורשות מזהה

## איך זה עובד?

### תהליך השליחה והקבלה

```
┌─────────────────┐
│  פרויקט חיצוני  │
│   (Filament)   │
└────────┬────────┘
         │
         │ שולח הודעה עם simulator_id
         ▼
┌─────────────────────────────────────┐
│  Backend - sendExternalMessage      │
│  ─────────────────────────────────  │
│  1. מקבל sessionId + simulator_id   │
│  2. שומר הודעה עם targetSimulatorId │
└────────┬────────────────────────────┘
         │
         │ שומר ב-DB
         ▼
┌─────────────────────────────────────┐
│  MongoDB - BotSession               │
│  ─────────────────────────────────  │
│  process_history: [                 │
│    {                                │
│      text: "הודעה",                 │
│      isExternal: true,              │
│      targetSimulatorId: "sim-..."  │
│    }                                │
│  ]                                  │
└────────┬────────────────────────────┘
         │
         │ Polling (כל 3 שניות)
         ▼
┌─────────────────────────────────────┐
│  Backend - getSessionMessages       │
│  ─────────────────────────────────  │
│  1. מקבל בקשה עם simulator_id       │
│  2. מסנן הודעות:                    │
│     ✓ ללא targetSimulatorId         │
│     ✓ targetSimulatorId תואם        │
│     ✗ targetSimulatorId לא תואם     │
└────────┬────────────────────────────┘
         │
         │ מחזיר הודעות מסוננות
         ▼
┌─────────────────────────────────────┐
│  Frontend - Simulator               │
│  ─────────────────────────────────  │
│  מציג רק הודעות רלוונטיות           │
└─────────────────────────────────────┘
```

## דוגמאות שימוש

### דוגמה 1: שליחה לסימולטור ספציפי מ-PHP
```php
// לאחר קבלת תשובה מ-web service
$simulatorId = $request->input('simulator_id'); // המזהה שנשלח בקריאה המקורית

Http::post('http://localhost:3001/api/sessions/send-message', [
    'sessionId' => $sessionId,
    'simulator_id' => $simulatorId, // שלח רק לסימולטור זה
    'message' => [
        'content' => 'תשובה מ-web service',
        'type' => 'Text'
    ]
]);
```

### דוגמה 2: שמירת מזהה סימולטור בפרמטר
```javascript
// בתוך הסימולטור - שמור את המזהה כשמתחילים web service
const callWebService = async (data) => {
  // שמור את המזהה לשימוש מאוחר יותר
  data._simulatorId = simulatorIdRef.current;
  
  await fetch('https://external-api.com/process', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};
```

### דוגמה 3: החזרת תשובה לסימולטור הנכון
```javascript
// בשרת חיצוני - החזר תשובה לסימולטור שביצע את הקריאה
app.post('/webhook', async (req, res) => {
  const { sessionId, simulatorId, result } = req.body;
  
  // שלח תשובה בחזרה לסימולטור המקורי
  await fetch('http://localhost:3001/api/sessions/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      simulator_id: simulatorId, // חשוב! שלח לסימולטור הנכון
      message: {
        content: `תוצאה: ${result}`,
        type: 'Text'
      }
    })
  });
  
  res.json({ success: true });
});
```

## שאלות נפוצות

### ❓ מה קורה אם לא אצרף simulator_id?
ההודעה תשלח לכל הסימולטורים שמאזינים לאותו sessionId (broadcast).

### ❓ איך אני מקבל את ה-simulator_id?
הסימולטור יוצר אותו אוטומטית. אם אתה צריך אותו מחוץ לסימולטור, תצטרך לשמור אותו (למשל, בפרמטר של web service).

### ❓ האם המזהה משתנה?
לא. המזהה נוצר פעם אחת כשהסימולטור נפתח ונשאר קבוע עד שסוגרים את הסימולטור.

### ❓ מה קורה אם יש שני סימולטורים עם אותו sessionId?
כל סימולטור יקבל רק את ההודעות שמיועדות לו (או ללא מזהה ספציפי). זה בדיוק התועלת במזהה סימולטור!

### ❓ איך מטפלים במספר משתמשים שבודקים בו-זמנית?
כל משתמש מקבל simulator_id שונה, כך שהודעות של אחד לא מופיעות אצל השני.

## אבטחה

⚠️ **חשוב**: מזהה הסימולטור הוא **לא** אמצעי אבטחה!
- הוא משמש רק לסינון הודעות
- אל תסמוך עליו לאימות משתמשים
- השתמש ב-authentication tokens לאבטחה אמיתית

## סיכום

מזהה הסימולטור מאפשר:
- ✅ שליחת הודעות לסימולטור ספציפי
- ✅ מספר משתמשים יכולים לבדוק בו-זמנית
- ✅ הודעות broadcast לכולם
- ✅ סינון אוטומטי של הודעות
- ✅ שילוב קל עם web services

---

**עודכן:** 21/04/2026  
**גרסה:** 1.1.0

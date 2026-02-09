# 🤖 WhatsApp Bot API - מדריך התקנה מהיר

## מה נוסף?

הוספנו API endpoint חדש שמאפשר לשרת Node.js חיצוני לשלוח הודעות WhatsApp ולקבל תגובות אוטומטיות מהבוטים שנבנו במערכת.

## ✅ קבצים שנוצרו

1. **backend/models/ChatSession.js** - מודל לניהול sessions של שיחות
2. **backend/controllers/chatController.js** - לוגיקת הבוט הראשית
3. **backend/routes/chatRoutes.js** - routes ל-API
4. **backend/utils/webserviceHandler.js** - טיפול בקריאות webservice
5. **backend/add-token.js** - script ליצירת tokens למשתמשים
6. **CHAT-API-GUIDE.md** - תיעוד מלא של ה-API
7. **CHAT-API-EXAMPLES.md** - דוגמאות שימוש

## 📝 עדכונים בקבצים קיימים

1. **backend/server.js** - הוסף את chatRoutes
2. **backend/models/User.js** - הוסף שדה token

## 🚀 התקנה ושימוש

### שלב 1: התחל את השרת

```bash
cd backend
npm install
npm start
```

### שלב 2: צור token למשתמש

```bash
node backend/add-token.js your-email@example.com
```

הסקריפט יחזיר לך את ה-token שנוצר.

### שלב 3: בנה בוט במערכת

1. התחבר למערכת
2. צור בוט חדש
3. הוסף node מסוג `automatic_responses`
4. בנה את ה-flow שלך

### שלב 4: שלח הודעה דרך API

```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer YOUR-TOKEN-HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "972501234567",
    "text": "שלום",
    "sender": "972509876543"
  }'
```

## 📊 פורמט התגובה

```json
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "972509876543",
  "messages": [
    {
      "type": "Text",
      "text": "שלום! איך אפשר לעזור?",
      "created": "2026-02-04 14:30:00"
    }
  ],
  "control": null
}
```

## 🎯 סוגי הודעות נתמכים

- ✅ **Text** - טקסט רגיל
- ✅ **Options** - תפריט אפשרויות עם כפתורים
- ✅ **Image** - תמונה
- ✅ **URL** - קישור
- ✅ **SendItem** - פריט בקרוסלה (carousel)
- ✅ **waitingwebservice** - המתנה לתגובה מ-API חיצוני

## 🔄 איך זה עובד?

1. **שליחת הודעה** → המערכת מקבלת הודעה מ-WhatsApp
2. **זיהוי/יצירת Session** → המערכת מזהה או יוצרת session חדש
3. **עיבוד לפי Flow** → המערכת עוברת על הנודים בבוט
4. **שמירת פרמטרים** → תשובות המשתמש נשמרות
5. **החזרת תגובה** → המערכת מחזירה את ההודעות המתאימות

## 🛠️ מאפיינים מתקדמים

### Webservice Integration

הבוט יכול לקרוא ל-APIs חיצוניים ולעבד את התגובה:

```javascript
// הבוט שולח ל-API שלך:
{
  "campaign": {...},
  "chat": {...},
  "parameters": [...],
  "value": {...},
  "process_history": [...]
}

// ה-API שלך מחזיר:
{
  "actions": [
    {"type": "SendMessage", "text": "..."},
    {"type": "SetParameter", "name": "...", "value": "..."},
    {"type": "Return", "value": "..."},
    {"type": "InputText", "options": [...]}
  ]
}
```

### Session Management

- Sessions אוטומטיים לכל sender
- תפוגה אחרי 10 דקות
- שמירת פרמטרים והיסטוריה

### תהליכים קבועים (Fixed Processes)

הבוט תומך בתהליכים משותפים שניתן לעשות בהם שימוש חוזר.

## 📚 תיעוד מלא

- **[CHAT-API-GUIDE.md](./CHAT-API-GUIDE.md)** - תיעוד טכני מפורט
- **[CHAT-API-EXAMPLES.md](./CHAT-API-EXAMPLES.md)** - דוגמאות שימוש

## ⚠️ דברים חשובים

1. **Token חובה** - כל משתמש חייב token ייחודי
2. **Phone חובה** - יש להגדיר phone למשתמש
3. **automatic_responses** - כל בוט חייב node מסוג זה כנקודת כניסה
4. **Session timeout** - 10 דקות (ניתן לשינוי ב-chatController.js)

## 🧪 בדיקה עם הסימולטור

הסימולטור המובנה במערכת כבר תומך בכל הפורמטים:

1. לחץ על "סימולטור" בעורך הבוט
2. שלח הודעות ובדוק את התגובות
3. הסימולטור משתמש באותה לוגיקה של ה-API

## 🔧 Troubleshooting

### הבוט לא מגיב
- ודא שיש token למשתמש
- ודא שיש בוט פעיל
- בדוק שיש node `automatic_responses`

### שגיאות Session
- בדוק את הלוגים בקונסול
- ודא ש-MongoDB פועל
- נקה sessions ישנים במסד הנתונים

### Webservice לא עובד
- ודא שה-URL נכון
- בדוק שה-API החיצוני מחזיר JSON תקין
- בדוק את הפורמט של ה-actions

## 💡 טיפים

- השתמש ב-Postman לבדיקת ה-API
- שמור את הלוגים לניפוי באגים
- השתמש בפרמטרים לאישור שיחה
- בדוק את process_history להיסטוריה מלאה

## 🎉 זהו!

המערכת מוכנה לשימוש. תוכל עכשיו לשלב את הבוטים שלך עם WhatsApp או כל מערכת הודעות אחרת.

---

**יצרה**: GitHub Copilot  
**תאריך**: 4 בפברואר 2026

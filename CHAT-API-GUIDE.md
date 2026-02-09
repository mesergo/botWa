# WhatsApp Bot API Integration

## סקירה כללית

המערכת כוללת API endpoint שמקבל הודעות WhatsApp ומחזיר תגובות אוטומטיות בהתאם לבוטים שנבנו במערכת.

## Endpoint

### POST `/api/chat/respond`

קבלת הודעת WhatsApp והחזרת תגובה אוטומטית.

#### Request Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body
```json
{
  "phone": "972501234567",
  "token": "user-bot-token",  // אופציונלי אם נשלח ב-header
  "text": "שלום",
  "sender": "972509876543"
}
```

#### Response Format
```json
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "972509876543",
  "messages": [
    {
      "type": "Text",
      "text": "שלום! איך אפשר לעזור?",
      "created": "2026-02-04 12:34:56"
    }
  ],
  "control": {
    "type": "InputText",
    "name": "user_name"
  }
}
```

## סוגי הודעות נתמכים

### 1. Text (טקסט רגיל)
```json
{
  "type": "Text",
  "text": "תוכן ההודעה",
  "created": "2026-02-04 12:34:56"
}
```

### 2. Options (תפריט אפשרויות)
```json
{
  "type": "Options",
  "text": "בחר אפשרות:",
  "options": [
    {
      "label": "אפשרות 1",
      "value": "option1",
      "image_url": "https://..."  // אופציונלי
    }
  ],
  "created": "2026-02-04 12:34:56"
}
```

### 3. Image (תמונה)
```json
{
  "type": "Image",
  "url": "https://example.com/image.jpg",
  "created": "2026-02-04 12:34:56"
}
```

### 4. URL (קישור)
```json
{
  "type": "URL",
  "text": "לחץ כאן למידע נוסף",
  "url": "https://example.com",
  "created": "2026-02-04 12:34:56"
}
```

### 5. SendItem (פריט בקרוסלה)
```json
{
  "type": "SendItem",
  "title": "כותרת",
  "subtitle": "תת כותרת",
  "image": "https://...",
  "url": "https://...",
  "options": [
    { "text": "כפתור", "value": "val" }
  ],
  "created": "2026-02-04 12:34:56"
}
```

### 6. waitingwebservice
```json
{
  "type": "waitingwebservice",
  "created": "2026-02-04 12:34:56"
}
```

## מנגנון Sessions

המערכת מנהלת sessions אוטומטיים:

- **יצירת session חדש**: בפעם הראשונה שמגיעה הודעה מ-sender מסוים
- **המשך session**: כל עוד לא עברו 10 דקות מההודעה האחרונה
- **סגירת session**: אוטומטית אחרי 10 דקות או בסיום תהליך

## פרמטרים

המערכת תומכת בפרמטרים דינמיים:

```
--user_name-- → יוחלף בערך הפרמטר user_name
```

פרמטרים נשמרים אוטומטית:
- מ-input nodes (על סמך `variableName`)
- מתפריטים (אם מוגדר `variableName`)
- מ-webservice responses

## התאמת סימולטור

הסימולטור הקיים כבר תומך בכל סוגי ההודעות:
- ✅ Text
- ✅ Options (תפריטים)
- ✅ Image
- ✅ URL
- ✅ SendItem (carousel)
- ✅ Input fields

## דוגמאות שימוש

### דוגמה 1: שיחה פשוטה
```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user-token-123" \
  -d '{
    "phone": "972501234567",
    "text": "שלום",
    "sender": "972509876543"
  }'
```

### דוגמה 2: בחירה בתפריט
```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user-token-123" \
  -d '{
    "phone": "972501234567",
    "text": "אפשרות 1",
    "sender": "972509876543"
  }'
```

## קבצים שנוצרו/עודכנו

1. **backend/models/ChatSession.js** - מודל לניהול sessions
2. **backend/controllers/chatController.js** - לוגיקת הבוט
3. **backend/routes/chatRoutes.js** - routes
4. **backend/server.js** - רישום ה-route החדש
5. **backend/models/User.js** - הוספת שדה token

## הערות חשובות

⚠️ **יש להוסיף את השדה `token` לכל משתמש במסד הנתונים**

אפשר לעשות זאת דרך:
1. ממשק ניהול משתמשים
2. Script חד-פעמי
3. עדכון ידני ב-MongoDB

## בעיות נפוצות

### הבוט לא מוצא את המשתמש
- ודא ש-`token` מוגדר ב-User במסד הנתונים
- בדוק שהטוקן נשלח נכון (header או body)

### Session לא נוצר
- ודא שיש לפחות בוט אחד למשתמש
- ודא שיש node מסוג `automatic_responses`

### הודעות לא מגיעות
- בדוק לוגים בקונסול
- ודא שה-flow מוגדר נכון עם edges

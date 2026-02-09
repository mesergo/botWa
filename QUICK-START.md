# 🚀 Quick Start - WhatsApp Bot API

## התחלה מהירה ב-5 דקות

### שלב 1: הפעלת המערכת

```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend  
cd frontend
npm install
npm run dev
```

### שלב 2: יצירת משתמש

1. פתח דפדפן: http://localhost:5173
2. הירשם עם אימייל וסיסמה
3. התחבר למערכת

### שלב 3: יצירת Token

```bash
# ב-terminal חדש
cd backend
npm run add-token your@email.com
# או
node add-token.js your@email.com
```

💾 **שמור את ה-token שמודפס!**

### שלב 4: בניית בוט ראשון

1. לחץ "בוט חדש"
2. תן שם לבוט
3. **חשוב**: הוסף node מסוג "תגובות אוטומטיות" (automatic_responses)
4. הוסף אפשרויות:
   - `כניסה` (ברירת מחדל)
   - `שלום`
   - `עזרה`
5. חבר כל אפשרות ל-"טקסט פלט" (output_text)
6. כתוב תגובה מתאימה

דוגמה פשוטה:
```
[תגובות אוטומטיות]
├─ כניסה → [טקסט: "ברוך הבא! כתוב 'עזרה' למידע"]
├─ שלום → [טקסט: "שלום! איך אפשר לעזור?"]
└─ עזרה → [תפריט עם אפשרויות: "מידע", "תמיכה", "סיום"]
```

### שלב 5: בדיקה בסימולטור

1. לחץ על כפתור "סימולטור" בעורך
2. כתוב "שלום"
3. בדוק שהבוט משיב

### שלב 6: קריאה ראשונה ל-API

```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-TOKEN-HERE" \
  -d '{
    "phone": "972501234567",
    "text": "שלום",
    "sender": "972509876543"
  }'
```

**החלף את YOUR-TOKEN-HERE בטוקן שקיבלת!**

### תגובה צפויה:

```json
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "972509876543",
  "messages": [
    {
      "type": "Text",
      "text": "שלום! איך אפשר לעזור?",
      "created": "2026-02-04 15:30:00"
    }
  ]
}
```

---

## 🎉 זהו! הבוט שלך עובד!

### מה עכשיו?

#### 1️⃣ בנה בוט מתקדם יותר
- הוסף שאלות (`input_text`)
- שמור תשובות בפרמטרים
- השתמש בתפריטים (`output_menu`)

#### 2️⃣ הוסף Webservice
- הוסף node `action_web_service`
- קרא ל-API שלך
- עבד את התגובה

#### 3️⃣ שלב עם WhatsApp
אפשר לשלב עם:
- Twilio API
- WhatsApp Business API
- כל מערכת הודעות אחרת

---

## 📚 למידה נוספת

- **[CHAT-API-GUIDE.md](./CHAT-API-GUIDE.md)** - תיעוד מלא
- **[CHAT-API-EXAMPLES.md](./CHAT-API-EXAMPLES.md)** - 6 דוגמאות מפורטות
- **[IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md)** - פרטים טכניים

---

## ❓ בעיות נפוצות

### הבוט לא עונה
✅ **פתרון**: ודא שיש node `automatic_responses` בבוט

### "User not found"
✅ **פתרון**: ודא שה-token נכון ונוצר עם add-token.js

### "No bots found"
✅ **פתרון**: צור בוט דרך הממשק (localhost:5173)

### Session timeout
✅ **פתרון**: Session נסגר אחרי 10 דקות - שלח הודעה חדשה

---

## 🧪 בדיקה מהירה

השתמש ב-test script:

```bash
# 1. עדכן את TOKEN ב-test-chat-api.js
# 2. הרץ:
npm run test-api
```

---

## 💡 טיפים

1. **פרמטרים**: השתמש ב-`--param_name--` לשמירת תשובות
2. **תפריטים**: תמיד הוסף אפשרות ברירת מחדל
3. **Webservices**: החזר `actions` במבנה הנכון
4. **Debugging**: בדוק לוגים ב-terminal של Backend

---

## 📞 צריך עזרה?

- בדוק את התיעוד המלא
- הסתכל על הדוגמאות
- בדוק את הלוגים

בהצלחה! 🚀

# ❓ שאלות נפוצות (FAQ)

## התקנה והפעלה

### ש: איך מתקינים את המערכת?
**ת:** 
```bash
# 1. Clone הפרויקט או הורד אותו
# 2. התקן dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. הפעל MongoDB
# 4. הפעל Backend ו-Frontend בטרמינלים נפרדים
```

ראה: [QUICK-START.md](./QUICK-START.md)

---

### ש: MongoDB לא מתחבר
**ת:** ודא ש:
- MongoDB מותקן ורץ
- הפורט 27017 פנוי
- קובץ .env מוגדר נכון

```bash
# בדוק אם MongoDB רץ:
# Windows:
services.msc → חפש MongoDB

# Linux/Mac:
sudo systemctl status mongod
```

---

### ש: איך יוצרים token למשתמש?
**ת:**
```bash
cd backend
node add-token.js your@email.com
# או
npm run add-token your@email.com
```

שמור את ה-token שמודפס!

---

## שימוש ב-API

### ש: איך שולחים הודעה דרך API?
**ת:**
```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "972501234567",
    "text": "שלום",
    "sender": "972509876543"
  }'
```

ראה דוגמאות ב-[CHAT-API-EXAMPLES.md](./CHAT-API-EXAMPLES.md)

---

### ש: מה ההבדל בין phone ל-sender?
**ת:**
- **phone**: מספר הטלפון של הבוט (המשתמש שיצר אותו)
- **sender**: מספר הטלפון של מי ששלח את ההודעה

---

### ש: איך מקבלים תגובה עם כפתורים?
**ת:** הבוט מחזיר:
```json
{
  "messages": [
    {
      "type": "Options",
      "text": "בחר אפשרות:",
      "options": [
        {"label": "כפתור 1", "value": "val1"},
        {"label": "כפתור 2", "value": "val2"}
      ]
    }
  ]
}
```

---

### ש: איך מגיבים לכפתור?
**ת:** שלח הודעה חדשה עם ה-value:
```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer YOUR-TOKEN" \
  -d '{"phone":"972501234567","text":"val1","sender":"972509876543"}'
```

---

## בניית בוטים

### ש: איזה node חובה לכל בוט?
**ת:** **automatic_responses** - זו נקודת הכניסה לכל בוט.

ללא node זה, הבוט לא יגיב.

---

### ש: איך שומרים תשובה של משתמש?
**ת:** 
1. הוסף node מסוג `input_text`
2. הגדר `variableName` (למשל: `user_name`)
3. התשובה תישמר אוטומטית
4. השתמש ב-`--user_name--` בטקסטים

---

### ש: איך עובדים פרמטרים?
**ת:** כתוב `--param_name--` בכל טקסט:
```
"שלום --user_name--, אתה בן --user_age--"
```

המערכת תחליף אוטומטית בערכים.

---

### ש: מה זה Fixed Process?
**ת:** תהליך משותף שאפשר לעשות בו שימוש חוזר בכמה מקומות בבוט.

דוגמה: תהליך "אישור פרטים" שחוזר בכל מקום.

---

## Webservices

### ש: איך מוסיפים קריאה ל-API חיצוני?
**ת:**
1. הוסף node מסוג `action_web_service`
2. הגדר URL עם parameters: `https://api.example.com?name=--user_name--`
3. ה-API שלך צריך להחזיר:
```json
{
  "actions": [
    {"type": "SendMessage", "text": "תודה!"},
    {"type": "Return", "value": "success"}
  ]
}
```

---

### ש: אילו actions נתמכים?
**ת:**
- `SetParameter` - שמירת ערך
- `SendMessage` - שליחת טקסט
- `SendWebpage` - שליחת קישור
- `SendImage` - שליחת תמונה
- `SendItem` - פריט בקרוסלה
- `InputText` - בקשה לקלט
- `Return` - ערך להחזרה (לפיצול)
- `ChangeState` - שינוי מצב

ראה: [CHAT-API-GUIDE.md](./CHAT-API-GUIDE.md#webservice-actions)

---

### ש: איך עובד Return?
**ת:** Return מאפשר לפצל את התזרים לפי ערך:
```javascript
// ה-API מחזיר:
{"actions": [{"type": "Return", "value": "yes"}]}

// בבוט:
action_web_service
├─ option 0: "yes" → path A
├─ option 1: "no" → path B
└─ default → path C
```

---

## Sessions

### ש: כמה זמן session פעיל?
**ת:** 10 דקות מההודעה האחרונה.

אפשר לשנות ב-chatController.js:
```javascript
if (diffMinutes > 10) { // שנה כאן
```

---

### ש: איך רואים את ה-parameters של session?
**ת:** בלוגים של Backend:
```
[BOT] Parameters: {"user_name":"דני","user_age":"25"}
```

או בדוק ב-MongoDB:
```javascript
db.chatsessions.find({sender: "972509876543"})
```

---

### ש: איך מנקים sessions ישנים?
**ת:**
```javascript
// MongoDB
db.chatsessions.deleteMany({
  updated_at: {$lt: new Date(Date.now() - 24*60*60*1000)}
})
```

---

## שגיאות נפוצות

### ש: "User not found"
**ת:** ודא ש:
- Token נכון
- המשתמש קיים ב-DB
- Token מוגדר ב-User document

תיקון:
```bash
node backend/add-token.js your@email.com
```

---

### ש: "No bots found for user"
**ת:** המשתמש לא יצר בוטים.

פתרון:
1. התחבר ל-http://localhost:5173
2. לחץ "בוט חדש"
3. בנה בוט

---

### ש: "No automatic responses configured"
**ת:** הבוט חסר node מסוג `automatic_responses`.

פתרון:
1. פתח את העורך
2. הוסף node "תגובות אוטומטיות"
3. הגדר אפשרויות

---

### ש: "Current node not found"
**ת:** Session מצביע על node שנמחק.

פתרון:
```javascript
// מחק את ה-session הישן
db.chatsessions.deleteOne({sender: "972509876543"})
```

---

### ש: הבוט לא עונה
**ת:** בדוק:
1. הלוגים ב-Backend terminal
2. ש-MongoDB מחובר
3. שיש node `automatic_responses`
4. שהאופציות מוגדרות נכון

---

## סימולטור

### ש: איך פותחים את הסימולטור?
**ת:** לחץ על כפתור "סימולטור" בעורך הבוט.

---

### ש: הסימולטור לא מציג תמונות
**ת:** ודא שה-URL של התמונה נגיש (לא localhost).

השתמש ב-URLs ציבוריים:
```
https://example.com/image.jpg ✅
http://localhost/image.jpg ❌
```

---

### ש: איך מאפסים סימולטור?
**ת:** לחץ על כפתור ⟳ (Reset) בסימולטור.

---

## Production

### ש: מה צריך לעשות לפני העלאה?
**ת:** עבור על [CHECKLIST.md](./CHECKLIST.md):
- שנה JWT_SECRET
- הוסף HTTPS
- הגדר rate limiting
- הוסף monitoring
- בדוק אבטחה

---

### ש: איך מגדירים HTTPS?
**ת:** השתמש ב-Nginx או Caddy:

```nginx
server {
  listen 443 ssl;
  server_name bot.example.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location /api {
    proxy_pass http://localhost:3001;
  }
}
```

ראה: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

### ש: איך מריצים את Backend ברקע?
**ת:** השתמש ב-PM2:
```bash
npm install -g pm2
pm2 start backend/server.js --name bot-api
pm2 save
pm2 startup
```

---

## ביצועים

### ש: איך משפרים ביצועים?
**ת:**
1. הוסף Redis caching
2. הוסף indexes ל-MongoDB
3. השתמש ב-connection pooling
4. הוסף CDN לתמונות
5. אופטימיזציה של queries

---

### ש: כמה requests יכול לטפל?
**ת:** תלוי בשרת, אבל בדרך כלל:
- Dev: ~100 req/sec
- Production (טוב): ~1000 req/sec
- Production (מעולה): 10000+ req/sec

עם Redis ו-load balancer אפשר יותר.

---

## פיתוח

### ש: איך מוסיפים action type חדש?
**ת:** ערוך את `backend/utils/webserviceHandler.js`:
```javascript
switch (actionType) {
  case 'MyNewAction':
    // הטיפול שלך
    break;
}
```

---

### ש: איך מוסיפים node type חדש?
**ת:**
1. הוסף את הסוג ב-`frontend/types.ts`
2. צור component ב-`frontend/components/nodes/`
3. הוסף ל-`nodeTypes` ב-App.tsx
4. הוסף טיפול ב-`chatController.js`

---

### ש: איך debug?
**ת:**
```javascript
// Backend - הוסף לוגים
console.log('[DEBUG]', variable);

// Frontend - פתח DevTools (F12)
console.log('[DEBUG]', data);

// MongoDB - בדוק נתונים
db.chatsessions.find().pretty()
```

---

## שילוב

### ש: איך משלבים עם WhatsApp?
**ת:** אפשר דרך:
1. Twilio API
2. WhatsApp Business API
3. Baileys (open-source)
4. WATI / Whaticket

הקוד שלנו מחזיר את הפורמט הנכון - רק צריך wrapper.

---

### ש: איך משלבים עם Telegram?
**ת:** דומה - השתמש ב-Telegram Bot API:
```javascript
// קבל הודעה מ-Telegram
const message = update.message.text;

// שלח ל-API שלנו
const response = await fetch('/api/chat/respond', {
  headers: {'Authorization': `Bearer ${token}`},
  body: JSON.stringify({
    phone: botPhone,
    text: message,
    sender: update.message.from.id
  })
});

// שלח תגובה חזרה ל-Telegram
```

---

### ש: תומכים ב-voice messages?
**ת:** לא מובנה, אבל אפשר להוסיף:
1. המר voice → text (speech-to-text)
2. שלח את הטקסט ל-API
3. המר תגובה חזרה ל-voice (text-to-speech)

---

## עזרה נוספת

### ש: לא מצאתי תשובה
**ת:** בדוק:
1. [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md) - רשימת כל התיעוד
2. הלוגים ב-Backend
3. הקונסול ב-Frontend (F12)
4. קוד ב-chatController.js

---

### ש: רוצה לתרום/לעזור
**ת:** מעולה! אפשר:
- להוסיף features
- לשפר תיעוד
- לדווח על באגים
- לשתף דוגמאות

---

## סיכום

רוב השאלות נפתרות ב:
1. בדיקת לוגים
2. קריאת [QUICK-START.md](./QUICK-START.md)
3. עיון ב-[CHAT-API-EXAMPLES.md](./CHAT-API-EXAMPLES.md)

**בהצלחה!** 🚀

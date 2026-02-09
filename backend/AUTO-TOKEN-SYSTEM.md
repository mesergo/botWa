# 🔑 מערכת טוקנים אוטומטית - WhatsApp Bot API

## ✅ מה השתנה?

### 1. **יצירת טוקן אוטומטית**
כל משתמש חדש שנרשם למערכת מקבל **אוטומטית** טוקן API ייחודי!

```javascript
// לפני - צריך להריץ add-token.js ידנית
node add-token.js user@example.com

// עכשיו - אוטומטי!
// כשמשתמש נרשם, נוצר לו טוקן אוטומטית
```

### 2. **הטוקן מוחזר בהרשמה ובהתחברות**

#### התחברות (Login)
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

**תשובה:**
```json
{
  "token": "jwt_token_for_dashboard",
  "user": {
    "id": "...",
    "name": "...",
    "email": "user@example.com",
    "api_token": "cb27631fb73e6658b9153dd0bdad599a..."  ← טוקן ל-WhatsApp API
  }
}
```

#### הרשמה (Register)
```bash
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "0501234567"
}
```

**תשובה:**
```json
{
  "token": "jwt_token_for_dashboard",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "api_token": "75d33570c726b43ec0b3a06e1057a9c6..."  ← טוקן חדש אוטומטי!
  }
}
```

### 3. **קבלת הטוקן בכל עת**

משתמש מחובר יכול לקבל את הטוקן שלו:

```bash
GET /api/auth/api-token
Authorization: Bearer YOUR_JWT_TOKEN
```

**תשובה:**
```json
{
  "api_token": "cb27631fb73e6658b9153dd0bdad599a...",
  "usage_example": "http://localhost:3001/api/chat/get-reply-text?phone=PHONE&token=cb27631fb73e6658b9153dd0bdad599a...&text=MESSAGE&sender=SENDER"
}
```

---

## 🎯 שימוש ב-API

### דוגמה מלאה - משתמש חדש

```bash
# 1. הרשמה
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "pass123",
    "phone": "0501234567"
  }'

# תשובה תכלול את api_token!
# api_token: "abc123def456..."

# 2. שימוש ישיר ב-WhatsApp API
curl "http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=abc123def456...&text=היי&sender=0548505808"
```

---

## 📱 אינטגרציה עם Dashboard

### בעת התחברות, שמור את ה-API Token

```javascript
// Login component
async function login(email, password) {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  // שמור JWT ל-dashboard
  localStorage.setItem('jwt_token', data.token);
  
  // שמור API token ל-WhatsApp
  localStorage.setItem('api_token', data.user.api_token);
  
  // הצג למשתמש
  console.log('Your WhatsApp API URL:');
  console.log(`http://localhost:3001/api/chat/get-reply-text?phone=PHONE&token=${data.user.api_token}&text=MESSAGE&sender=SENDER`);
}
```

### הצגת הטוקן בממשק

```javascript
// Settings/Profile component
async function showApiToken() {
  const jwtToken = localStorage.getItem('jwt_token');
  
  const response = await fetch('http://localhost:3001/api/auth/api-token', {
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });
  
  const data = await response.json();
  
  // הצג למשתמש
  alert(`Your API Token: ${data.api_token}`);
  alert(`Usage: ${data.usage_example}`);
}
```

---

## 🔧 עדכון משתמשים קיימים

אם יש לך משתמשים קיימים ללא טוקן:

```bash
cd backend
node update-tokens.js
```

הסקריפט יעדכן אוטומטית את כל המשתמשים ויציג את הטוקנים שלהם.

---

## 🔐 אבטחה

- ✅ כל טוקן הוא **64 תווים אקראיים** (32 bytes hex)
- ✅ הטוקנים **ייחודיים** - אין שני משתמשים עם אותו טוקן
- ✅ הטוקנים נשמרים ב-DB עם **unique index**
- ✅ במקרה של התנגשות, נוצר טוקן חדש אוטומטית

---

## 📋 סיכום - מה כבר עובד

1. ✅ **משתמש חדש** → מקבל טוקן אוטומטית
2. ✅ **התחברות** → מחזיר את הטוקן בתשובה
3. ✅ **הרשמה** → מחזיר את הטוקן בתשובה
4. ✅ **משתמש מחובר** → יכול לקבל טוקן ב-`GET /api/auth/api-token`
5. ✅ **משתמשים קיימים** → ניתן לעדכן עם `update-tokens.js`
6. ✅ **שימוש ב-API** → פשוט להעתיק את הטוקן לקישור

---

## 🎉 דוגמה מהירה

```bash
# הטוקן שקיבלת מעדכון המשתמשים:
TOKEN="cb27631fb73e6658b9153dd0bdad599a9d05398edc41679dfe3526836e63589f"

# השתמש בו ישירות:
curl "http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=$TOKEN&text=שלום&sender=0548505808"
```

**התשובה תהיה:**
```json
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "0548505808",
  "messages": [
    {
      "type": "Text",
      "text": "שלום! איך אני יכול לעזור?",
      "created": "2026-02-04 16:30:00"
    }
  ],
  "control": null
}
```

---

**הכל אוטומטי! 🚀**

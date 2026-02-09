# 🔄 שימוש ב-API - POST ו-GET

## 📌 שני פורמטים נתמכים

המערכת תומכת **גם ב-GET וגם ב-POST** לאותה פונקציונליות.

---

## 1️⃣ שימוש ב-GET (Filament Compatible)

### 🔗 URL Format
```
GET http://localhost:3001/api/chat/get-reply-text?phone=PHONE&token=TOKEN&text=TEXT&sender=SENDER
```

### ✅ דוגמה
```bash
curl "http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=mytoken&text=שלום&sender=0548505808"
```

### JavaScript
```javascript
const response = await fetch(
  `http://localhost:3001/api/chat/get-reply-text?` +
  `phone=972548505808&token=mytoken&text=שלום&sender=0548505808`
);
const data = await response.json();
```

---

## 2️⃣ שימוש ב-POST (Modern API)

### 🔗 URL Format
```
POST http://localhost:3001/api/chat/respond
Content-Type: application/json
```

### 📦 Body
```json
{
  "phone": "972548505808",
  "token": "mytoken",
  "text": "שלום",
  "sender": "0548505808"
}
```

### ✅ דוגמה - cURL
```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "972548505808",
    "token": "mytoken",
    "text": "שלום",
    "sender": "0548505808"
  }'
```

### ✅ דוגמה - JavaScript (Fetch)
```javascript
const response = await fetch('http://localhost:3001/api/chat/respond', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone: '972548505808',
    token: 'mytoken',
    text: 'שלום',
    sender: '0548505808'
  })
});
const data = await response.json();
```

### ✅ דוגמה - JavaScript (Axios)
```javascript
import axios from 'axios';

const response = await axios.post('http://localhost:3001/api/chat/respond', {
  phone: '972548505808',
  token: 'mytoken',
  text: 'שלום',
  sender: '0548505808'
});
const data = response.data;
```

### ✅ דוגמה - PHP
```php
$data = [
    'phone' => '972548505808',
    'token' => 'mytoken',
    'text' => 'שלום',
    'sender' => '0548505808'
];

$ch = curl_init('http://localhost:3001/api/chat/respond');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$result = json_decode($response, true);
curl_close($ch);
```

### ✅ דוגמה - Python
```python
import requests

data = {
    'phone': '972548505808',
    'token': 'mytoken',
    'text': 'שלום',
    'sender': '0548505808'
}

response = requests.post(
    'http://localhost:3001/api/chat/respond',
    json=data
)
result = response.json()
```

---

## 3️⃣ אימות עם Authorization Header (אופציונלי)

שני הפורמטים תומכים גם ב-token ב-Header:

### GET עם Header
```bash
curl -H "Authorization: Bearer mytoken" \
  "http://localhost:3001/api/chat/get-reply-text?phone=972548505808&text=שלום&sender=0548505808"
```

### POST עם Header
```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mytoken" \
  -d '{
    "phone": "972548505808",
    "text": "שלום",
    "sender": "0548505808"
  }'
```

### JavaScript עם Header
```javascript
// GET
const responseGet = await fetch(
  'http://localhost:3001/api/chat/get-reply-text?phone=972548505808&text=שלום&sender=0548505808',
  {
    headers: {
      'Authorization': 'Bearer mytoken'
    }
  }
);

// POST
const responsePost = await fetch('http://localhost:3001/api/chat/respond', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mytoken'
  },
  body: JSON.stringify({
    phone: '972548505808',
    text: 'שלום',
    sender: '0548505808'
  })
});
```

---

## 📊 פורמט התשובה (זהה לשתי השיטות)

```json
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "0548505808",
  "messages": [
    {
      "type": "Text",
      "text": "שלום! איך אפשר לעזור?",
      "created": "2026-02-04 15:30:45"
    }
  ],
  "control": null
}
```

---

## ⚖️ השוואה - מתי להשתמש במה?

| קריטריון | GET | POST |
|----------|-----|------|
| **פשטוט** | ✅ יותר פשוט - רק URL | צריך headers ו-body |
| **תאימות לגיסי** | ✅ תואם Filament/PHP | תואם REST APIs מודרניים |
| **בדיקה בדפדפן** | ✅ ניתן לפתוח ישירות | דורש כלי כמו Postman |
| **אבטחה** | ⚠️ Token נראה ב-URL | ✅ Token ב-body/header |
| **אורך מקסימלי** | ⚠️ מוגבל (URL length) | ✅ ללא הגבלה |
| **Logging** | ⚠️ Token עלול להישמר ב-logs | ✅ יותר בטוח |
| **מומלץ ל** | Webhooks, אינטגרציה פשוטה | אפליקציות מודרניות |

---

## 🎯 המלצות

### השתמש ב-GET כאשר:
- ✅ משלבים עם מערכות ישנות (Filament, WordPress, וכו')
- ✅ צריך לבדוק במהירות בדפדפן
- ✅ Webhooks פשוטים
- ✅ הטקסט קצר

### השתמש ב-POST כאשר:
- ✅ בונים אפליקציה חדשה
- ✅ צריך שליחת טקסט ארוך
- ✅ חשוב אבטחה מקסימלית
- ✅ עובדים עם REST API standards

---

## 🔐 אבטחה

### ❌ לא מומלץ (Token ב-URL):
```
GET /api/chat/get-reply-text?token=SECRET_TOKEN&...
```
*הטוקן יישמר ב-browser history, server logs, proxies*

### ✅ מומלץ (Token ב-Header):
```bash
# GET עם header
curl -H "Authorization: Bearer SECRET_TOKEN" \
  "http://localhost:3001/api/chat/get-reply-text?phone=...&text=...&sender=..."

# POST עם header
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"...", "text":"...", "sender":"..."}'
```

---

## 📝 דוגמאות מלאות - תסריט שלם

### תסריט עם GET

```bash
# 1. הודעה ראשונה
curl "http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=mytoken&text=היי&sender=0548505808"

# 2. בחירה מתפריט
curl "http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=mytoken&text=תמיכה&sender=0548505808"

# 3. הזנת טקסט
curl "http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=mytoken&text=אני%20צריך%20עזרה&sender=0548505808"
```

### תסריט עם POST

```bash
# 1. הודעה ראשונה
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -d '{"phone":"972548505808","token":"mytoken","text":"היי","sender":"0548505808"}'

# 2. בחירה מתפריט
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -d '{"phone":"972548505808","token":"mytoken","text":"תמיכה","sender":"0548505808"}'

# 3. הזנת טקסט
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -d '{"phone":"972548505808","token":"mytoken","text":"אני צריך עזרה","sender":"0548505808"}'
```

---

## 🧪 בדיקה מהירה

### בדיקת GET בדפדפן
פשוט פתח את הקישור הזה בדפדפן (החלף TOKEN):
```
http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=YOUR_TOKEN&text=test&sender=0548505808
```

### בדיקת POST עם PowerShell
```powershell
$body = @{
    phone = "972548505808"
    token = "YOUR_TOKEN"
    text = "test"
    sender = "0548505808"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/chat/respond" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## ✅ סיכום

המערכת שלך תומכת ב-**שתי השיטות באותו אופן מדויק**:

1. **GET** → `/api/chat/get-reply-text` (Filament compatible)
2. **POST** → `/api/chat/respond` (Modern REST API)

**שתיהן מחזירות את אותו פורמט תשובה ועובדות עם אותה לוגיקה!** 🎉

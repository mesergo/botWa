# דוגמאות שימוש ב-Chat API

## הגדרת Token למשתמש

לפני שתוכל להשתמש ב-API, יש להגדיר token למשתמש ב-MongoDB:

```javascript
// דרך MongoDB Compass או script
db.User.updateOne(
  { email: "user@example.com" },
  { $set: { token: "my-unique-bot-token-12345", phone: "972501234567" } }
)
```

## דוגמה 1: שיחה בסיסית עם תגובה אוטומטית

### בניית הבוט:
1. צור בוט חדש
2. הוסף node `automatic_responses` עם אפשרויות:
   - `כניסה` (ברירת מחדל)
   - `שלום` (שווה)
   - `עזרה` (שווה)
3. חבר כל אפשרות ל-output_text node

### קריאה ל-API:

```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-unique-bot-token-12345" \
  -d '{
    "phone": "972501234567",
    "text": "שלום",
    "sender": "972509876543"
  }'
```

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
      "created": "2026-02-04 14:30:00"
    }
  ],
  "control": null
}
```

---

## דוגמה 2: שאלון עם שמירת פרמטרים

### בניית הבוט:
1. `automatic_responses` → `כניסה`
2. `output_text`: "מה שמך?"
3. `input_text` עם variableName: `user_name`
4. `output_text`: "שלום --user_name--, מה הגיל שלך?"
5. `input_text` עם variableName: `user_age`
6. `output_text`: "תודה --user_name--, קיבלנו שאתה בן --user_age--"

### שיחה מלאה:

```bash
# הודעה ראשונה
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer my-token" \
  -d '{"phone":"972501234567","text":"היי","sender":"972509876543"}'

# Response:
# {
#   "messages": [
#     {"type":"Text","text":"מה שמך?"}
#   ],
#   "control": {"type":"InputText","name":"user_name"}
# }

# תגובה עם שם
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer my-token" \
  -d '{"phone":"972501234567","text":"דני","sender":"972509876543"}'

# Response:
# {
#   "messages": [
#     {"type":"Text","text":"שלום דני, מה הגיל שלך?"}
#   ],
#   "control": {"type":"InputText","name":"user_age"}
# }

# תגובה עם גיל
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer my-token" \
  -d '{"phone":"972501234567","text":"25","sender":"972509876543"}'

# Response:
# {
#   "messages": [
#     {"type":"Text","text":"תודה דני, קיבלנו שאתה בן 25"}
#   ]
# }
```

---

## דוגמה 3: תפריט אפשרויות

### בניית הבוט:
1. `automatic_responses` → `כניסה`
2. `output_menu` עם אפשרויות:
   - "מידע על המוצר"
   - "תמיכה טכנית"
   - "דבר עם נציג"
3. חבר כל אפשרות לצומת מתאים

### קריאה:

```bash
# פתיחת שיחה
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer my-token" \
  -d '{"phone":"972501234567","text":"היי","sender":"972509876543"}'

# Response:
# {
#   "messages": [
#     {
#       "type": "Options",
#       "text": "במה אפשר לעזור?",
#       "options": [
#         {"label":"מידע על המוצר","value":"מידע על המוצר"},
#         {"label":"תמיכה טכנית","value":"תמיכה טכנית"},
#         {"label":"דבר עם נציג","value":"דבר עם נציג"}
#       ]
#     }
#   ]
# }

# בחירה באפשרות
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer my-token" \
  -d '{"phone":"972501234567","text":"תמיכה טכנית","sender":"972509876543"}'
```

---

## דוגמה 4: שימוש ב-Webservice

### בניית הבוט:
1. `automatic_responses` → `כניסה`
2. `output_text`: "על מה תרצה לשאול?"
3. `action_web_service` עם URL:
   ```
   https://your-api.com/faq?query=--user_question--
   ```
4. חבר ל-Return options (0, 1, 2...)

### API שלך צריך להחזיר:

```json
{
  "actions": [
    {
      "type": "SetParameter",
      "name": "last_question_id",
      "value": 1
    },
    {
      "type": "SendMessage",
      "text": "התשובה לשאלתך היא..."
    },
    {
      "type": "InputText",
      "options": ["שאלה נוספת", "סיום"]
    }
  ]
}
```

### שיחה:

```bash
# פתיחה
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer my-token" \
  -d '{"phone":"972501234567","text":"שלום","sender":"972509876543"}'

# Response: "על מה תרצה לשאול?"

# שאלה
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer my-token" \
  -d '{"phone":"972501234567","text":"מה שעות הפעילות","sender":"972509876543"}'

# הבוט שולח ל-webservice ומקבל תגובה
# Response:
# {
#   "messages": [
#     {"type":"Text","text":"שעות הפעילות: 9:00-17:00"},
#     {"type":"Options","options":[
#       {"label":"שאלה נוספת","value":"שאלה נוספת"},
#       {"label":"סיום","value":"סיום"}
#     ]}
#   ]
# }
```

---

## דוגמה 5: שליחת תמונות וקישורים

### בניית הבוט:
1. `automatic_responses` → `קטלוג`
2. `output_text`: "הנה המוצרים שלנו:"
3. `output_image` עם URL: `https://example.com/product.jpg`
4. `output_link` עם:
   - linkLabel: "לחץ לפרטים נוספים"
   - url: `https://example.com/product/123`

### קריאה:

```bash
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer my-token" \
  -d '{"phone":"972501234567","text":"קטלוג","sender":"972509876543"}'

# Response:
# {
#   "messages": [
#     {"type":"Text","text":"הנה המוצרים שלנו:"},
#     {"type":"Image","url":"https://example.com/product.jpg"},
#     {"type":"URL","text":"לחץ לפרטים נוספים","url":"https://example.com/product/123"}
#   ]
# }
```

---

## דוגמה 6: Carousel (SendItem)

הבוט שלך יכול להחזיר items מ-webservice:

### Webservice Response:

```json
{
  "actions": [
    {
      "type": "SendItem",
      "title": "מוצר 1",
      "subtitle": "תיאור המוצר",
      "image": "https://example.com/product1.jpg",
      "url": "https://example.com/product1",
      "options": [
        {"text": "הוסף לסל", "value": "add_1"}
      ]
    },
    {
      "type": "SendItem",
      "title": "מוצר 2",
      "subtitle": "תיאור נוסף",
      "image": "https://example.com/product2.jpg",
      "options": [
        {"text": "הוסף לסל", "value": "add_2"}
      ]
    }
  ]
}
```

הסימולטור יציג את זה כ-carousel עם כרטיסים.

---

## טיפים חשובים

### 1. ניהול Sessions
- Session נשמר 10 דקות אחרי הודעה אחרונה
- כל sender מקבל session נפרד
- Parameters נשמרים ב-session

### 2. Testing
השתמש ב-Postman או בסימולטור המובנה לבדיקה.

### 3. Debugging
בדוק את הלוגים בקונסול של Node.js:
```bash
npm run dev
# או
node backend/server.js
```

### 4. Production
לפני העלאה לפרודקשן:
- הגדר `NODE_ENV=production`
- השתמש ב-HTTPS
- הגדר rate limiting
- שמור tokens בצורה מאובטחת

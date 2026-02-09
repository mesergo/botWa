# 📘 דוגמאות לשימוש ב-API - WhatsApp Bot System

## 🔗 URL בסיסי
```
http://localhost:3001/api/chat/get-reply-text
```

## 📝 פורמט הבקשה (GET Request)

### פרמטרים נדרשים:
- `phone` - מספר טלפון של הלקוח (לדוגמה: 972733456080)
- `token` - טוקן אימות של המשתמש
- `text` - הטקסט שהמשתמש שלח
- `sender` - מספר טלפון של השולח (לדוגמה: 0548505808)

---

## 📋 תרחיש מלא - דוגמה מפורטת

### שלב 1️⃣: פתיחת שיחה חדשה
**הלקוח שולח הודעה ראשונה: "היי"**

```bash
# בקשה
GET http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=cghghvmui&text=היי&sender=0548505808
```

```json
// תשובה
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "0548505808",
  "messages": [
    {
      "type": "Text",
      "text": "שלום! ברוך הבא לבוט שלנו",
      "created": "2026-02-04 14:54:24"
    },
    {
      "type": "Menu",
      "text": "בחר אפשרות:",
      "created": "2026-02-04 14:54:24",
      "options": [
        "מידע כללי",
        "תמיכה טכנית",
        "שירותים"
      ]
    }
  ],
  "control": null
}
```

---

### שלב 2️⃣: בחירה מתפריט
**הלקוח בחר: "תמיכה טכנית"**

```bash
# בקשה
GET http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=cghghvmui&text=תמיכה%20טכנית&sender=0548505808
```

```json
// תשובה
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "0548505808",
  "messages": [
    {
      "type": "Text",
      "text": "אני כאן לעזור! על מה תרצה לשאול?",
      "created": "2026-02-04 14:55:10"
    },
    {
      "type": "Text",
      "text": "נא להקליד את השאלה שלך:",
      "created": "2026-02-04 14:55:10"
    }
  ],
  "control": "waiting_input"
}
```

---

### שלב 3️⃣: הזנת טקסט חופשי
**הלקוח שואל: "איך אני משנה סיסמה?"**

```bash
# בקשה
GET http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=cghghvmui&text=איך%20אני%20משנה%20סיסמה&sender=0548505808
```

```json
// תשובה
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "0548505808",
  "messages": [
    {
      "type": "Text",
      "text": "כדי לשנות סיסמה:",
      "created": "2026-02-04 14:56:32"
    },
    {
      "type": "Text",
      "text": "1. היכנס להגדרות\n2. לחץ על 'אבטחה'\n3. בחר 'שינוי סיסמה'",
      "created": "2026-02-04 14:56:32"
    },
    {
      "type": "Link",
      "url": "https://example.com/reset-password",
      "text": "לחץ כאן לשינוי סיסמה",
      "created": "2026-02-04 14:56:32"
    }
  ],
  "control": null
}
```

---

### שלב 4️⃣: קבלת תמונה
**הלקוח מבקש: "תמונה"**

```bash
# בקשה
GET http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=cghghvmui&text=תמונה&sender=0548505808
```

```json
// תשובה
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "0548505808",
  "messages": [
    {
      "type": "Image",
      "image": "https://example.com/images/guide.jpg",
      "caption": "הנה מדריך מפורט",
      "created": "2026-02-04 14:57:45"
    }
  ],
  "control": null
}
```

---

### שלב 5️⃣: תהליך קבוע (Fixed Process)
**הלקוח בוחר בתהליך שמפעיל תהליך קבוע**

```bash
# בקשה
GET http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=cghghvmui&text=הזמנה%20חדשה&sender=0548505808
```

```json
// תשובה
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "0548505808",
  "messages": [
    {
      "type": "Text",
      "text": "מתחיל תהליך הזמנה",
      "created": "2026-02-04 14:58:12"
    },
    {
      "type": "Text",
      "text": "אנא הזן את שמך:",
      "created": "2026-02-04 14:58:12"
    }
  ],
  "control": "waiting_input"
}
```

---

### שלב 6️⃣: קריאה לשירות חיצוני (WebService)
**הבוט מבצע קריאה ל-API חיצוני**

```bash
# בקשה
GET http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=cghghvmui&text=בדוק%20מלאי&sender=0548505808
```

```json
// תשובה (אחרי קריאה לשירות)
{
  "StatusId": 1,
  "StatusDescription": "Success",
  "sender": "0548505808",
  "messages": [
    {
      "type": "Text",
      "text": "מצטער, המוצר אזל מהמלאי",
      "created": "2026-02-04 14:59:30"
    },
    {
      "type": "Text",
      "text": "האם תרצה לקבל התראה כשחוזר למלאי?",
      "created": "2026-02-04 14:59:30"
    }
  ],
  "control": null
}
```

---

## 🌐 דוגמאות URL מלאות

### דוגמה 1: הודעה ראשונה
```
http://localhost:3001/api/chat/get-reply-text?phone=972733456080&token=cghghvmui&text=שלום&sender=0548505808
```

### דוגמה 2: תשובה לתפריט
```
http://localhost:3001/api/chat/get-reply-text?phone=972733456080&token=cghghvmui&text=מידע%20כללי&sender=0548505808
```

### דוגמה 3: שאלה עם מילים מרובות
```
http://localhost:3001/api/chat/get-reply-text?phone=972733456080&token=cghghvmui&text=איך%20אני%20יכול%20לעזור%20לך&sender=0548505808
```

### דוגמה 4: טקסט בעברית (URL encoded)
```
http://localhost:3001/api/chat/get-reply-text?phone=972733456080&token=cghghvmui&text=%D7%90%D7%A0%D7%99%20%D7%A6%D7%A8%D7%99%D7%9A%20%D7%A2%D7%96%D7%A8%D7%94&sender=0548505808
```

---

## 🔧 דוגמאות בשפות תכנות

### JavaScript (Fetch)
```javascript
async function sendWhatsAppMessage(phone, text, sender, token) {
  const url = `http://localhost:3001/api/chat/get-reply-text?` +
    `phone=${encodeURIComponent(phone)}` +
    `&token=${encodeURIComponent(token)}` +
    `&text=${encodeURIComponent(text)}` +
    `&sender=${encodeURIComponent(sender)}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.StatusId === 1) {
    console.log('הודעות:', data.messages);
    return data.messages;
  } else {
    console.error('שגיאה:', data.StatusDescription);
    return null;
  }
}

// שימוש
sendWhatsAppMessage(
  '972548505808', 
  'היי', 
  '0548505808', 
  'cghghvmui'
);
```

### PHP (cURL)
```php
<?php
function sendWhatsAppMessage($phone, $text, $sender, $token) {
    $url = "http://localhost:3001/api/chat/get-reply-text?" . 
           "phone=" . urlencode($phone) . 
           "&token=" . urlencode($token) . 
           "&text=" . urlencode($text) . 
           "&sender=" . urlencode($sender);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if ($data['StatusId'] == 1) {
        return $data['messages'];
    } else {
        return null;
    }
}

// שימוש
$messages = sendWhatsAppMessage(
    '972548505808',
    'היי',
    '0548505808',
    'cghghvmui'
);

foreach ($messages as $msg) {
    echo $msg['type'] . ": " . $msg['text'] . "\n";
}
?>
```

### Python (requests)
```python
import requests
from urllib.parse import urlencode

def send_whatsapp_message(phone, text, sender, token):
    params = {
        'phone': phone,
        'token': token,
        'text': text,
        'sender': sender
    }
    
    url = f"http://localhost:3001/api/chat/get-reply-text?{urlencode(params)}"
    response = requests.get(url)
    data = response.json()
    
    if data['StatusId'] == 1:
        return data['messages']
    else:
        print(f"Error: {data['StatusDescription']}")
        return None

# שימוש
messages = send_whatsapp_message(
    '972548505808',
    'היי',
    '0548505808',
    'cghghvmui'
)

for msg in messages:
    print(f"{msg['type']}: {msg.get('text', '')}")
```

### C# (.NET)
```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web;
using Newtonsoft.Json;

public class WhatsAppBot
{
    private static readonly HttpClient client = new HttpClient();
    
    public async Task<dynamic> SendWhatsAppMessage(
        string phone, string text, string sender, string token)
    {
        var queryParams = HttpUtility.ParseQueryString(string.Empty);
        queryParams["phone"] = phone;
        queryParams["token"] = token;
        queryParams["text"] = text;
        queryParams["sender"] = sender;
        
        string url = $"http://localhost:3001/api/chat/get-reply-text?{queryParams}";
        
        var response = await client.GetAsync(url);
        var json = await response.Content.ReadAsStringAsync();
        var data = JsonConvert.DeserializeObject<dynamic>(json);
        
        if (data.StatusId == 1)
        {
            return data.messages;
        }
        else
        {
            Console.WriteLine($"Error: {data.StatusDescription}");
            return null;
        }
    }
}

// שימוש
var bot = new WhatsAppBot();
var messages = await bot.SendWhatsAppMessage(
    "972548505808", 
    "היי", 
    "0548505808", 
    "cghghvmui"
);
```

---

## 📊 סוגי הודעות (Message Types)

### 1. Text - טקסט פשוט
```json
{
  "type": "Text",
  "text": "שלום עולם",
  "created": "2026-02-04 14:54:24"
}
```

### 2. Image - תמונה
```json
{
  "type": "Image",
  "image": "https://example.com/image.jpg",
  "caption": "תיאור התמונה",
  "created": "2026-02-04 14:54:24"
}
```

### 3. Link - קישור
```json
{
  "type": "Link",
  "url": "https://example.com",
  "text": "לחץ כאן",
  "created": "2026-02-04 14:54:24"
}
```

### 4. Menu - תפריט
```json
{
  "type": "Menu",
  "text": "בחר אפשרות:",
  "created": "2026-02-04 14:54:24",
  "options": ["אפשרות 1", "אפשרות 2", "אפשרות 3"]
}
```

---

## ⚠️ טיפול בשגיאות

### שגיאה: טוקן לא חוקי
```json
{
  "StatusId": 0,
  "StatusDescription": "User not found",
  "sender": "0548505808",
  "messages": [],
  "control": null
}
```

### שגיאה: פרמטר חסר
```json
{
  "StatusId": 0,
  "StatusDescription": "Missing phone or token",
  "sender": null,
  "messages": [],
  "control": null
}
```

### שגיאה: אין בוטים
```json
{
  "StatusId": 0,
  "StatusDescription": "No bots found for user",
  "sender": "0548505808",
  "messages": [],
  "control": null
}
```

---

## 🔐 קבלת טוקן

להוספת טוקן למשתמש:

```bash
cd backend
node add-token.js your-email@example.com cghghvmui
```

או ליצור טוקן רנדומלי:

```bash
node add-token.js your-email@example.com
```

---

## 🎯 Control States

כאשר `control` לא null, זה אומר שהבוט מחכה לקלט מהמשתמש:

- `"waiting_input"` - הבוט מחכה לטקסט חופשי
- `null` - אין צורך בקלט מיוחד

---

## 💡 טיפים חשובים

1. **URL Encoding**: תמיד להשתמש ב-`encodeURIComponent()` או שווה ערך לטקסט בעברית
2. **Session Management**: כל צמד `phone` + `sender` יוצר session נפרד
3. **Session Timeout**: Sessions נסגרים אוטומטית אחרי 10 דקות חוסר פעילות
4. **Token Security**: אל תשתף טוקנים בקוד פומבי - השתמש ב-environment variables
5. **Error Handling**: תמיד בדוק את `StatusId` לפני עיבוד ה-`messages`

---

## 🌍 שימוש ב-Production

החלף את `localhost:3001` ב-URL של השרת שלך:

```
https://bot.message.co.il/api/chat/get-reply-text?phone=972548505808&token=xxx&text=היי&sender=0548505808
```

---

## 📞 תמיכה

לשאלות ובעיות, פנה למפתח המערכת.

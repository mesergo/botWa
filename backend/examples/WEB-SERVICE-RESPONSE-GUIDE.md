# מדריך: עיבוד תשובות Web Service ושליחת המשך תסריט

## 📋 סקירה כללית

הפונקציה `processWebServiceResponse` מאפשרת לך לקבל תגובה מ-web service חיצוני ולשלוח את המשך התסריט לסימולטור בפורמט WhatsApp המתאים.

### מה הפונקציה עושה?

1. מקבלת תגובה מ-web service עם רשימת פעולות (actions)
2. ממירה כל פעולה לפורמט WhatsApp המתאים
3. שולחת את כל ההודעות לסימולטור בסדר הנכון
4. מטפלת בטעויות באופן אוטומטי

---

## 🚀 שימוש בסיסי

### JavaScript/Node.js

```javascript
const { processWebServiceResponse } = require('./external-message-example.js');

// תגובה מ-web service
const webServiceResponse = {
  actions: [
    { type: 'SendMessage', text: 'ההזמנה התקבלה בהצלחה!' },
    { type: 'SendImage', url: 'https://example.com/receipt.jpg' },
    { type: 'InputText', text: 'האם תרצה להוסיף עוד משהו?', options: ['כן', 'לא'] }
  ]
};

// שליחת התגובה לסימולטור
await processWebServiceResponse(sessionId, webServiceResponse);
```

### PHP/Laravel/Filament

```php
use App\Services\BotMessageService;

$botService = new BotMessageService();

// תגובה מ-web service
$actions = [
    ['type' => 'SendMessage', 'text' => 'ההזמנה התקבלה בהצלחה!'],
    ['type' => 'SendImage', 'url' => 'https://example.com/receipt.jpg'],
    ['type' => 'InputText', 'text' => 'האם תרצה להוסיף עוד משהו?', 'options' => ['כן', 'לא']]
];

// שליחת התגובה לסימולטור
$botService->processWebServiceResponse($sessionId, $actions);
```

---

## 📝 סוגי Actions נתמכים

### 1. SendMessage - שליחת הודעת טקסט

```javascript
{ 
  type: 'SendMessage', 
  text: 'זו הודעת טקסט רגילה' 
}
```

**דוגמאות שימוש:**
- הודעות מידע
- הודעות אישור
- הודעות שגיאה
- הודעות סטטוס

---

### 2. SendImage - שליחת תמונה

```javascript
{ 
  type: 'SendImage', 
  url: 'https://example.com/image.jpg',
  text: 'כיתוב לתמונה (אופציונלי)'
}
```

**דוגמאות שימוש:**
- קבלות
- תעודות
- תרשימים
- מפות

---

### 3. SendVideo - שליחת סרטון

```javascript
{ 
  type: 'SendVideo', 
  url: 'https://example.com/video.mp4',
  text: 'כיתוב לסרטון (אופציונלי)'
}
```

**דוגמאות שימוש:**
- הדרכות
- הדגמות מוצר
- סיכומי פגישות

---

### 4. SendDocument - שליחת מסמך

```javascript
{ 
  type: 'SendDocument', 
  url: 'https://example.com/file.pdf',
  text: 'שם המסמך (אופציונלי)'
}
```

**דוגמאות שימוש:**
- PDF של חשבוניות
- קבצי Excel
- מסמכי Word
- חוזים

---

### 5. SendWebpage - שליחת קישור

```javascript
{ 
  type: 'SendWebpage', 
  url: 'https://example.com',
  text: 'לחץ כאן למידע נוסף'
}
```

**דוגמאות שימוש:**
- קישורים למעקב משלוחים
- לינקים לתשלום
- קישורים לדפי מידע

---

### 6. InputText - בקשת קלט/תפריט

```javascript
// עם אפשרויות (תפריט)
{ 
  type: 'InputText', 
  text: 'מה תרצה לעשות?',
  options: ['אפשרות 1', 'אפשרות 2', 'אפשרות 3']
}

// בלי אפשרויות (קלט חופשי)
{ 
  type: 'InputText', 
  text: 'אנא הכנס את שם המשתמש שלך'
}
```

**דוגמאות שימוש:**
- תפריטים
- שאלות כן/לא
- בחירת אפשרויות
- בקשת מידע מהמשתמש

---

### 7. SetParameter - שמירת פרמטר

```javascript
{ 
  type: 'SetParameter', 
  name: 'orderStatus',
  value: 'confirmed'
}
```

**דוגמאות שימוש:**
- שמירת מצב הזמנה
- שמירת מזהים
- שמירת ערכים לשימוש מאוחר יותר

---

### 8. Return - ערך חזרה

```javascript
{ 
  type: 'Return', 
  value: 'success'
}
```

**שימוש:** להחלטות בתוך הבוט (לא מוצג למשתמש)

---

### 9. ChangeState - שינוי מצב בוט

```javascript
{ 
  type: 'ChangeState', 
  value: 'payment_pending'
}
```

**שימוש:** לניהול מצבי בוט מורכבים

---

## 💡 דוגמאות מעשיות

### דוגמה 1: תהליך הזמנה מלא

```javascript
const orderActions = [
  { type: 'SendMessage', text: '⏳ מעבד את ההזמנה שלך...' },
  { type: 'SetParameter', name: 'orderId', value: '12345' },
  { type: 'SendMessage', text: '✅ ההזמנה התקבלה!' },
  { type: 'SendMessage', text: 'מספר הזמנה: #12345' },
  { type: 'SendImage', url: 'https://example.com/receipt.jpg', text: 'קבלה' },
  { type: 'SendDocument', url: 'https://example.com/invoice.pdf', text: 'חשבונית מס' },
  { type: 'InputText', text: 'האם תרצה לקבל עדכונים ב-SMS?', options: ['כן', 'לא'] }
];

await processWebServiceResponse(sessionId, orderActions);
```

---

### דוגמה 2: תהליך אישור תשלום

```javascript
const paymentActions = [
  { type: 'SendMessage', text: '💳 מעבד תשלום...' },
  { type: 'SendMessage', text: '✅ התשלום אושר בהצלחה!' },
  { type: 'SendMessage', text: 'סכום: 150₪\nמספר אישור: 789456' },
  { type: 'SendWebpage', url: 'https://example.com/receipt/789456', text: 'לחץ כאן לצפייה בקבלה' },
  { type: 'InputText', text: 'מה תרצה לעשות כעת?', options: [
    'הזמנה חדשה',
    'צפייה בהיסטוריה',
    'צור קשר עם תמיכה',
    'יציאה'
  ]}
];

await processWebServiceResponse(sessionId, paymentActions);
```

---

### דוגמה 3: תהליך עם טיפול בשגיאות

```javascript
async function processOrderWithErrorHandling(sessionId, orderData) {
  try {
    // קריאה ל-web service
    const response = await fetch('https://api.example.com/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    if (result.success) {
      // הצלחה - שלח את התסריט המלא
      const successActions = [
        { type: 'SendMessage', text: '✅ ההזמנה עובדה בהצלחה!' },
        { type: 'SendMessage', text: `מספר הזמנה: ${result.orderId}` },
        { type: 'SendImage', url: result.receiptUrl },
        { type: 'InputText', text: 'מה תרצה לעשות?', options: ['הזמנה נוספת', 'סיום'] }
      ];
      
      await processWebServiceResponse(sessionId, successActions);
    } else {
      // כישלון - שלח הודעת שגיאה
      const errorActions = [
        { type: 'SendMessage', text: '❌ אירעה שגיאה בעיבוד ההזמנה' },
        { type: 'SendMessage', text: `סיבה: ${result.error}` },
        { type: 'InputText', text: 'האם תרצה לנסות שוב?', options: ['כן', 'לא'] }
      ];
      
      await processWebServiceResponse(sessionId, errorActions);
    }
  } catch (error) {
    // שגיאת רשת או שגיאה טכנית
    const criticalErrorActions = [
      { type: 'SendMessage', text: '❌ אירעה שגיאה בחיבור לשרת' },
      { type: 'SendMessage', text: 'אנא נסה שוב מאוחר יותר' }
    ];
    
    await processWebServiceResponse(sessionId, criticalErrorActions);
  }
}
```

---

## 🔧 שימוש מתקדם - שילוב עם Filament

### דוגמה: עיבוד טופס ב-Filament

```php
<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Services\BotMessageService;
use Filament\Pages\Actions\Action;

class CreateOrder extends CreateRecord
{
    protected function afterCreate(): void
    {
        // אם יש session_id מהבוט
        if ($this->record->bot_session_id) {
            $botService = app(BotMessageService::class);
            
            // בניית רצף הודעות
            $actions = [
                ['type' => 'SendMessage', 'text' => '✅ ההזמנה נוצרה בהצלחה!'],
                ['type' => 'SendMessage', 'text' => 'מספר הזמנה: #' . $this->record->id],
                ['type' => 'SetParameter', 'name' => 'orderId', 'value' => $this->record->id],
            ];
            
            // הוסף תמונה אם יש מוצר
            if ($this->record->product_image) {
                $actions[] = [
                    'type' => 'SendImage',
                    'url' => $this->record->product_image,
                    'text' => 'המוצר שהזמנת'
                ];
            }
            
            // הוסף מסמך אם יש חשבונית
            if ($this->record->invoice_pdf) {
                $actions[] = [
                    'type' => 'SendDocument',
                    'url' => $this->record->invoice_pdf,
                    'text' => 'חשבונית מס'
                ];
            }
            
            // תפריט המשך
            $actions[] = [
                'type' => 'InputText',
                'text' => 'מה תרצה לעשות כעת?',
                'options' => [
                    'צפייה בהזמנה',
                    'הזמנה נוספת',
                    'צור קשר',
                    'חזור לתפריט'
                ]
            ];
            
            // שלח את כל הרצף
            $botService->processWebServiceResponse(
                $this->record->bot_session_id,
                $actions
            );
        }
    }
}
```

---

## 🎯 טיפים והמלצות

### 1. סדר הפעולות חשוב
הפונקציה מעבדת את ה-actions לפי הסדר שמועבר. הקפד לסדר אותם בצורה הגיונית.

### 2. המתנות בין הודעות
הפונקציה מוסיפה המתנה אוטומטית של 300ms בין הודעות כדי שהמשתמש יוכל לקרוא.

### 3. טיפול בשגיאות
תמיד עטוף את הקריאה ל-`processWebServiceResponse` ב-try-catch.

### 4. שימוש ב-SetParameter
השתמש ב-SetParameter לשמור מידע שתצטרך לגשת אליו מאוחר יותר בתהליך.

### 5. תפריטים ברורים
כשיוצרים InputText עם options, השתמש בטקסט ברור וקצר לכל אפשרות.

---

## 🐛 פתרון בעיות

### הודעות לא מגיעות
- ודא ש-sessionId תקין
- בדוק שהשרת פועל
- בדוק לוגים בקונסול

### הודעות מגיעות פעמיים
- הבעיה תוקנה! ודא שיש לך את הגרסה העדכנית

### השגיאה "Invalid action type"
- בדוק שהשם של ה-type נכתב נכון (case-sensitive)
- ודא שכל ה-action כולל את השדות הנדרשים

---

## 📚 משאבים נוספים

- `external-message-example.js` - דוגמאות JavaScript מלאות
- `filament-integration-example.php` - דוגמאות PHP/Filament מלאות
- `CHAT-API-GUIDE.md` - מדריך ל-Chat API
- `EXTERNAL-MESSAGE-API.md` - מדריך ל-External Message API

---

## 🤝 תמיכה

לשאלות ותמיכה, צור קשר עם צוות הפיתוח.

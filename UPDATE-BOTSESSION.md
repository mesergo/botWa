# 📝 עדכון - שימוש ב-BotSession הקיים

## מה השתנה?

במקום ליצור מודל חדש `ChatSession`, עדכנו את המודל הקיים **BotSession** להכיל את כל הפונקציונליות הנדרשת.

---

## למה?

1. ✅ **אין כפילות** - לא צריך שני מודלים דומים
2. ✅ **עקביות** - השתמשנו במה שכבר היה קיים
3. ✅ **פשטות** - פחות קבצים לנהל
4. ✅ **תאימות** - עובד עם הקוד הקיים

---

## מה עודכן ב-BotSession?

### שדות חדשים שנוספו:
```javascript
{
  flow_id: ObjectId,           // קישור לבוט
  sender: String,              // מזהה השולח
  current_node_id: String,     // הנוד הנוכחי
  is_active: Boolean,          // האם ה-session פעיל
  waiting_text_input: Boolean, // ממתין לקלט
  waiting_webservice: Boolean, // ממתין ל-webservice
  last_user_input: String,     // הקלט האחרון
  execution_stack: Array       // מחסנית לתהליכים מקוננים
}
```

### Indexes שנוספו:
```javascript
{ customer_phone: 1, sender: 1, is_active: 1 }
{ user_id: 1, is_active: 1 }
```

---

## השפעה על הקוד

### קבצים שעודכנו:
1. ✅ `backend/models/BotSession.js` - השדות החדשים
2. ✅ `backend/controllers/chatController.js` - שימוש ב-BotSession
3. ✅ `backend/utils/webserviceHandler.js` - שימוש ב-BotSession

### קבצים שנמחקו:
- ❌ `backend/models/ChatSession.js` - לא צריך יותר

---

## תאימות לאחור

המודל המעודכן תואם לחלוטין לשימוש הקודם:
- כל הסכמות והפונקציות הקיימות עדיין עובדות
- רק נוספו שדות חדשים
- ה-collection name נשאר "BotSession"

---

## בדיקה

הכל צריך לעבוד כרגיל:

```bash
# 1. הפעל את השרת
npm start

# 2. צור token
node backend/add-token.js email@example.com

# 3. שלח הודעה
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer TOKEN" \
  -d '{"phone":"972501234567","text":"שלום","sender":"test"}'
```

---

## סיכום

✅ השתמשנו במה שכבר היה קיים  
✅ הרחבנו את BotSession במקום ליצור חדש  
✅ הכל עובד אותו דבר, פשוט יותר נקי  

**אין צורך בשינויים נוספים!**

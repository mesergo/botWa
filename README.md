# FlowBot Studio - מערכת בניית בוטים לוויזואלית

## 🎯 מה זה?

מערכת מתקדמת לבניית בוטים שיחה (chatbots) בצורה ויזואלית, ללא צורך בקוד.  
כוללת:
- ✅ עורך drag & drop ויזואלי
- ✅ סימולטור מובנה לבדיקות
- ✅ **API חדש** לשילוב WhatsApp ומערכות חיצוניות
- ✅ ניהול משתמשים וגרסאות
- ✅ תהליקים משותפים (Fixed Processes)
- ✅ אינטגרציה עם Webservices

---

## 🆕 חדש! WhatsApp Bot API

**נוסף לאחרונה**: API endpoint מלא שמאפשר לשלוח הודעות ולקבל תגובות אוטומטיות!

📚 **קרא עוד**:
- [CHAT-API-README.md](./CHAT-API-README.md) - מדריך מהיר
- [CHAT-API-GUIDE.md](./CHAT-API-GUIDE.md) - תיעוד טכני
- [CHAT-API-EXAMPLES.md](./CHAT-API-EXAMPLES.md) - דוגמאות שימוש
- [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) - סיכום שינויים

**שימוש מהיר**:
```bash
# 1. צור token למשתמש
node backend/add-token.js your@email.com

# 2. שלח הודעה
curl -X POST http://localhost:3001/api/chat/respond \
  -H "Authorization: Bearer YOUR-TOKEN" \
  -d '{"phone":"972501234567","text":"שלום","sender":"972509876543"}'
```

---

## סביבות הרצה

### 🏠 הרצה מקומית (Local Development)

הפרויקט מוגדר להרוץ עם MongoDB מקומי:

1. **התחל MongoDB מקומי:**
   ```powershell
   # ודא ש-MongoDB מותקן ורץ על localhost:27017
   ```

2. **הרץ את Backend:**
   ```powershell
   cd backend
   npm install
   npm start
   ```
   השרת ירוץ על: `http://localhost:3001`

3. **הרץ את Frontend:**
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
   האתר יפתח על: `http://localhost:5173`

---

### 🚀 הרצה בשרת (Production)

להעלאה לשרת, עקוב אחר [מדריך ההעלאה המלא](DEPLOYMENT.md)

**בקצרה:**

1. **עדכן את קובץ .env בשרת:**
   ```bash
   # backend/.env
   MONGODB_URI=mongodb://bots:b0t5bots@127.0.0.1:27017/bots
   JWT_SECRET=your-strong-random-secret
   NODE_ENV=production
   PORT=3001
   ```

2. **העלה את הקבצים לשרת** (דרך SCP, WinSCP, או FileZilla)

3. **בשרת, התקן והרץ:**
   ```bash
   cd backend
   npm install
   pm2 start server.js --name flowbot-backend
   ```

4. **הגדר את Frontend:**
   - עדכן את `frontend/App.tsx`:
     ```typescript
     const API_BASE = 'http://your-domain.com:3001/api';
     ```
   - בנה את הפרויקט:
     ```bash
     cd frontend
     npm install
     npm run build
     ```

5. **הגדר Nginx והדומיין** - ראה [DEPLOYMENT.md](DEPLOYMENT.md)

---

## קבצי הגדרות

| קובץ | מטרה |
|------|------|
| `backend/.env` | הגדרות למחשב המקומי (לא להעלות ל-Git) |
| `backend/.env.production` | תבנית להגדרות שרת (העתק ל-.env בשרת) |
| `backend/.env.example` | תיעוד להגדרות זמינות |

---

## משתני סביבה (Environment Variables)

### Backend

| משתנה | תיאור | ברירת מחדל |
|-------|-------|-----------|
| `PORT` | פורט השרת | `3001` |
| `NODE_ENV` | סביבה (development/production) | `development` |
| `MONGODB_URI` | כתובת MongoDB | `mongodb://localhost:27017/flowbot` |
| `JWT_SECRET` | מפתח להצפנת טוקנים | `flowbot-secure-jwt-key` |

### מבנה MONGODB_URI

**מקומי:**
```
mongodb://localhost:27017/flowbot
```

**שרת:**
```
mongodb://username:password@server-ip:27017/database-name
```

**דוגמה לשרת:**
```
mongodb://bots:b0t5bots@127.0.0.1:27017/bots
```

---

## פתרון בעיות נפוצות

### ❌ Backend לא מתחבר ל-MongoDB

1. ודא ש-MongoDB רץ:
   ```powershell
   # בדוק תהליכים
   Get-Process mongod
   ```

2. בדוק את קובץ `.env`:
   ```bash
   # הכתובת נכונה?
   cat backend/.env
   ```

3. בדוק את הלוגים:
   ```bash
   # השרת ידפיס הודעות שגיאה מפורטות
   npm start
   ```

### ❌ Frontend לא מתחבר ל-Backend

1. ודא שה-Backend רץ על `http://localhost:3001`

2. בדוק ש-`API_BASE` ב-`frontend/App.tsx` נכון:
   ```typescript
   const API_BASE = 'http://localhost:3001/api'; // מקומי
   // או
   const API_BASE = 'http://your-domain.com:3001/api'; // שרת
   ```

---

## טכנולוגיות

- **Frontend:** React + TypeScript + Vite + ReactFlow
- **Backend:** Node.js + Express + MongoDB/Mongoose
- **Authentication:** JWT (JSON Web Tokens)

---

## קישורים שימושיים

- [מדריך העלאה מלא](DEPLOYMENT.md)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [PM2 Process Manager](https://pm2.keymetrics.io/)

---

**נוצר בשנת 2026** 🚀

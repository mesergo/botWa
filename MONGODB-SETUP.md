# 🗄️ הדרכת התקנה והפעלה של MongoDB מקומי

## 📥 התקנת MongoDB

### Windows

#### אופציה 1: MongoDB Community Server (מומלץ)

1. **הורד את MongoDB:**
   - היכנס ל: https://www.mongodb.com/try/download/community
   - בחר:
     - Version: Latest (7.0 ומעלה)
     - Platform: Windows
     - Package: MSI
   
2. **התקן:**
   - הרץ את קובץ ה-MSI
   - בחר "Complete" installation
   - ✅ סמן "Install MongoDB as a Service"
   - ✅ סמן "Run service as Network Service user"
   - ✅ **אל תסמן** "Install MongoDB Compass" (אלא אם תרצי GUI)
   
3. **וודא שהשירות רץ:**
   ```powershell
   # פתח PowerShell כמנהל
   Get-Service MongoDB
   
   # אם השירות לא רץ, הפעל אותו:
   Start-Service MongoDB
   ```

#### אופציה 2: MongoDB Community Edition (Portable)

1. **הורד ZIP:**
   - https://www.mongodb.com/try/download/community
   - בחר Package: ZIP
   
2. **חלץ לתיקייה:**
   ```
   C:\mongodb
   ```

3. **צור תיקיית data:**
   ```powershell
   New-Item -ItemType Directory -Path C:\mongodb\data
   ```

4. **הפעל MongoDB ידנית:**
   ```powershell
   C:\mongodb\bin\mongod.exe --dbpath C:\mongodb\data
   ```

---

## 🚀 הפעלת MongoDB מקומי

### שיטה 1: כשירות (Service) - אוטומטי
אם התקנת כשירות, MongoDB כבר רץ! בדוק:

```powershell
Get-Service MongoDB
```

פלט צפוי:
```
Status   Name               DisplayName
------   ----               -----------
Running  MongoDB            MongoDB Server
```

### שיטה 2: הפעלה ידנית
```powershell
# נווט לתיקיית MongoDB
cd C:\mongodb\bin

# הפעל את השרת (חלון זה צריך להישאר פתוח!)
.\mongod.exe --dbpath C:\mongodb\data
```

פלט צפוי:
```
{"t":{"$date":"2026-02-04T..."},"s":"I","c":"NETWORK","msg":"Listening on","attr":{"address":"127.0.0.1:27017"}}
```

---

## 🔍 בדיקת חיבור

### בדיקה 1: MongoDB Shell (mongosh)
```powershell
# אם התקנת MongoDB, mongosh כלול
mongosh

# בתוך ה-shell:
> show dbs
> use bots
> show collections
> exit
```

### בדיקה 2: דרך הפרויקט
```powershell
cd backend
npm start
```

חפש את ההודעה:
```
✅ MongoDxxxxxxxcted successfully
📊 Database: bots
🔗 Connection state: Connected
```

---

## 🛠️ פתרון בעיות נפוצות

### ❌ בעיה: "Authentication failed"
**פתרון:** השתמש ב-MongoDB ללא אימות (למצב development)

עדכן את `.env`:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/bots
```

### ❌ בעיה: "ECONNREFUSED"
**פתרון:** MongoDB לא רץ

```powershell
# בדוק אם השירות רץ
Get-Service MongoDB

# אם לא רץ, הפעל:
Start-Service MongoDB

# אם אין שירות, הפעל ידנית:
C:\mongodb\bin\mongod.exe --dbpath C:\mongodb\data
```

### ❌ בעיה: "Address already in use"
**פתרון:** יש כבר MongoDB שרץ על פורט 27017

```powershell
# מצא את התהליך
Get-Process mongod

# עצור אותו
Stop-Process -Name mongod

# הפעל מחדש
Start-Service MongoDB
```

### ❌ בעיה: "Data directory not found"
**פתרון:** צור את תיקיית ה-data

```powershell
New-Item -ItemType Directory -Path C:\mongodb\data
```

---

## 🎯 הפעלת הפרויקט עם MongoDB

### צעד אחר צעד:

1. **וודא ש-MongoDB רץ:**
   ```powershell
   Get-Service MongoDB
   # או
   mongosh --eval "db.version()"
   ```

2. **הפעל את ה-Backend:**
   ```powershell
   cd backend
   npm start
   ```

3. **צפה ל-log:**
   ```
   🔌 Connecting to MongoDB...
   🌍 Environment: development
   📍 xxxxxction String: mongodb://127.0.0.1/bots
   ✅ MongoDB Connected successfully
   📊 Database: bots
   🔗 Connection state: Connected
   🚀 Server is running on port 3001
   ```

4. **הוסף טוקן למשתמש:**
   ```powershell
   node add-token.js admin@example.com mytoken123
   ```

5. **בדוק ש-API עובד:**
   ```
   http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=mytoken123&text=היי&sender=0548505808
   ```

---

## 📊 MongoDB Compass (GUI - אופציונלי)

אם תרצי ממשק גרפי לניהול ה-DB:

1. **הורד MongoDB Compass:**
   https://www.mongodb.com/try/download/compass

2. **התחבר:**
   - Connection String: `mongodb://localhost:27017`
   - לחץ Connect

3. **צפה ב-Database:**
   - Database: `bots`
   - Collections: `users`, `botflows`, `botsessions`, וכו'

---

## 🔐 הגדרת אימות (Production בלבד!)

⚠️ **למצב development לא צריך אימות!**

לפרודקשן, צור משתמש:

```javascript
// התחבר ל-mongosh
mongosh

// עבור ל-admin database
use admin

// צור משתמש root
db.createUser({
  user: "admin",
  pwd: "securePassword123",
  roles: ["root"]
})

// צור משתמש לבוטים
use bots
db.createUser({
  user: "bots",
  pwd: "b0t5bots",
  roles: [{ role: "readWrite", db: "bots" }]
})
```

ועדכן `.env.production`:
```env
MONGODB_URI=mongodb://bots:b0t5bots@127.0.0.1:27017/bots?authSource=bots
```

---

## 📋 סיכום - Quick Start

```powershell
# 1. בדוק שMongoDB רץ
Get-Service MongoDB

# 2. אם לא, הפעל אותו
Start-Service MongoDB

# 3. הפעל backend
cd backend
npm start

# 4. הוסף טוקן
node add-token.js test@example.com testtoken

# 5. בדוק בדפדפן
# http://localhost:3001/api/chat/get-reply-text?phone=972548505808&token=testtoken&text=היי&sender=0548505808
```

---

## 🌐 MongoDB Atlas (Cloud - אלטרנטיבה)

אם לא רוצה להריץ MongoDB מקומי:

1. צור חשבון חינם ב: https://www.mongodb.com/cloud/atlas
2. צור Cluster חינם (M0)
3. קבל את ה-Connection String
4. עדכן `.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/bots?retryWrites=true&w=majority
   ```

---

## ✅ Checklist

- [ ] MongoDB מותקן
- [ ] MongoDB רץ (כשירות או ידנית)
- [ ] חיבור מוצלח ב-mongosh
- [ ] Backend מתחבר בהצלחה
- [ ] נוצר טוקן למשתמש
- [ ] API עובד בדפדפן

---

**מוכן! עכשיו אפשר להתחיל לעבוד עם המערכת 🎉**

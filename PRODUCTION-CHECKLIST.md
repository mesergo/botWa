# רשימת בדיקה להעלאת פרויקט לפרודקשן
## Production Deployment Checklist

## ✅ לפני העלאה לשרת

### 1. הגדרת משתני סביבה (Environment Variables)

**בשרת** צור קובץ `.env` עם הערכים האמיתיים:

```bash
# בשרת, בתיקייה backend/:
cp .env.example .env
nano .env
```

**ערוך את הקובץ עם הערכים הבאים:**

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# MongoDB Configuration
MONGODB_URI=mongodb://bots:b0t5bots@127.0.0.1:27017/bots

# JWT Secret - צור מפתח חזק!
# הרץ: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=YOUR_GENERATED_SECRET_HERE

# CORS Settings - הגדר את הדומיין האמיתי שלך
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

### 2. יצירת JWT Secret חזק

**במחשב המקומי או בשרת**, הרץ:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

העתק את הפלט והשתמש בו בתור `JWT_SECRET` בקובץ `.env`.

### 3. בדיקת אבטחה

- [ ] קובץ `.env` לא מועלה ל-git (בדוק `.gitignore`)
- [ ] JWT_SECRET הוחלף במפתח חזק ואקראי
- [ ] CORS מוגדר לדומיין הספציפי שלך (לא `*`)
- [ ] NODE_ENV=production בקובץ `.env` בשרת

### 4. בדיקת MongoDB

ודא ש-MongoDB רץ בשרת:

```bash
# בדוק סטטוס של MongoDB
sudo systemctl status mongod

# אם לא רץ, הפעל:
sudo systemctl start mongod
sudo systemctl enable mongod
```

## 🚀 העלאה לשרת

### אופציה 1: העלאה ידנית עם SCP/SFTP

**מ-PowerShell במחשב המקומי:**

```powershell
# העתק את כל הפרויקט (ללא node_modules)
scp -r "C:\Users\בלומא\Desktop\בלימי ויזל\פרויקט חדש בוטים\project-bots\backend" user@your-server-ip:~/
scp -r "C:\Users\בלומא\Desktop\בלימי ויזל\פרויקט חדש בוטים\project-bots\frontend" user@your-server-ip:~/
```

### אופציה 2: שימוש ב-Git (מומלץ)

**במחשב המקומי:**

```bash
# אתחול git repository
cd "C:\Users\בלומא\Desktop\בלימי ויזל\פרויקט חדש בוטים\project-bots"
git init
git add .
git commit -m "Initial commit"

# העלה ל-GitHub/GitLab (אם יש לך)
git remote add origin your-git-repo-url
git push -u origin main
```

**בשרת:**

```bash
# שכפל את הפרויקט
git clone your-git-repo-url project-bots
cd project-bots/backend
```

## 📦 התקנה בשרת

### 1. התקן את החבילות

```bash
cd ~/project-bots/backend
npm install --production
```

### 2. צור את קובץ .env

```bash
cp .env.example .env
nano .env
# עדכן את כל הערכים לפי הצורך
```

### 3. התקן PM2 לניהול תהליכים

```bash
# התקנה גלובלית של PM2
sudo npm install -g pm2

# הפעל את השרת
pm2 start server.js --name "flowbot-backend" --node-args="--max-old-space-size=2048"

# שמור את התצורה
pm2 save

# הגדר PM2 להתחיל אוטומטית
pm2 startup
# העתק והרץ את הפקודה שמוצגת
```

### 4. פקודות שימושיות ל-PM2

```bash
# בדוק סטטוס
pm2 status

# צפה בלוגים
pm2 logs flowbot-backend

# הפעל מחדש
pm2 restart flowbot-backend

# עצור
pm2 stop flowbot-backend

# הסר
pm2 delete flowbot-backend
```

## 🌐 הגדרת Frontend

### 1. עדכן את כתובת ה-API

ערוך את `frontend/App.tsx` או `frontend/constants.tsx` (תלוי באיפה מוגדר ה-API URL):

```typescript
// שנה מ:
const API_BASE = 'http://localhost:3001/api';

// ל:
const API_BASE = 'http://your-server-ip:3001/api';
// או אם יש לך דומיין:
const API_BASE = 'https://api.yourdomain.com/api';
```

### 2. בנה את ה-Frontend

```bash
cd ~/project-bots/frontend
npm install
npm run build
```

### 3. הגש את ה-Frontend עם Nginx (מומלץ)

**התקן Nginx:**

```bash
sudo apt update
sudo apt install nginx
```

**צור קובץ הגדרות:**

```bash
sudo nano /etc/nginx/sites-available/flowbot
```

**הוסף את ההגדרות הבאות:**

```nginx
server {
    listen 80;
    server_name your-server-ip;  # או yourdomain.com

    # Frontend
    location / {
        root /home/user/project-bots/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**הפעל את ההגדרות:**

```bash
sudo ln -s /etc/nginx/sites-available/flowbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 אבטחה נוספת (מומלץ מאוד)

### 1. הגדר Firewall

```bash
# אפשר רק פורטים נדרשים
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw enable
```

### 2. התקן SSL Certificate (HTTPS)

```bash
# עם Let's Encrypt (חינם)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 3. הגבלת קצב (Rate Limiting) - אופציונלי

התקן `express-rate-limit` ב-backend:

```bash
npm install express-rate-limit
```

## 🔍 בדיקות לאחר העלאה

- [ ] השרת רץ: `pm2 status`
- [ ] MongoDB מחובר: בדוק logs עם `pm2 logs`
- [ ] ה-API עובד: `curl http://localhost:3001/api/auth/test`
- [ ] Frontend נטען: פתח בדפדפן `http://your-server-ip`
- [ ] CORS עובד: בדוק בקונסולה של הדפדפן

## 📊 ניטור

```bash
# צפה בלוגים בזמן אמת
pm2 logs flowbot-backend --lines 100

# מידע על שימוש במשאבים
pm2 monit

# סטטוס מפורט
pm2 show flowbot-backend
```

## 🆘 פתרון בעיות נפוצות

### Backend לא מתחיל

```bash
# בדוק logs
pm2 logs flowbot-backend --err

# בדוק אם הפורט תפוס
sudo netstat -tulpn | grep 3001

# בדוק משתני סביבה
pm2 env flowbot-backend
```

### שגיאת חיבור ל-MongoDB

```bash
# בדוק אם MongoDB רץ
sudo systemctl status mongod

# בדוק את הלוגים של MongoDB
sudo tail -f /var/log/mongodb/mongod.log

# נסה להתחבר ידנית
mongosh "mongodb://bots:b0t5bots@127.0.0.1:27017/bots"
```

### שגיאות CORS

ודא ש:
1. `CORS_ORIGIN` בקובץ `.env` מוגדר נכון
2. `NODE_ENV=production` מוגדר
3. השרת הופעל מחדש אחרי השינויים

## 📝 סיכום מהיר

```bash
# 1. העלה קבצים לשרת
scp -r backend frontend user@server:~/project-bots/

# 2. בשרת - הגדר backend
cd ~/project-bots/backend
cp .env.example .env
nano .env  # ערוך את הערכים
npm install --production
pm2 start server.js --name "flowbot-backend"
pm2 save

# 3. הגדר frontend
cd ~/project-bots/frontend
npm install
npm run build

# 4. הגדר Nginx (אופציונלי אבל מומלץ)
sudo apt install nginx
# הגדר את הקונפיגורציה כמו למעלה

# 5. בדוק שהכל עובד
pm2 status
pm2 logs
```

---

**הערה:** תיעוד זה מניח ש:
- יש לך גישת SSH לשרת
- השרת מריץ Linux (Ubuntu/Debian)
- MongoDB מותקן ורץ בשרת
- יש לך הרשאות sudo

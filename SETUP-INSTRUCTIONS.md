# הוראות התקנה מלאות - botswa.message.co.il
## Complete Setup Instructions

---

## ✅ רשימת דברים שצריך לעשות

### 1️⃣ בדיקות לפני התחלה

- [ ] השרת מריץ Ubuntu/Debian Linux
- [ ] יש גישת SSH לשרת
- [ ] יש הרשאות sudo
- [ ] הדומיין botswa.message.co.il מצביע לכתובת IP של השרת
- [ ] MongoDB מותקן ורץ בשרת

---

## 📦 שלב 1: הכנת השרת

### התקנת Node.js ו-NPM

```bash
# עדכון מערכת
sudo apt update
sudo apt upgrade -y

# התקנת Node.js (גרסה 18 ומעלה)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# בדיקה
node --version
npm --version
```

### התקנת MongoDB

```bash
# ייבוא המפתח הציבורי
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# הוספת repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# התקנה
sudo apt update
sudo apt install -y mongodb-org

# הפעלה
sudo systemctl start mongod
sudo systemctl enable mongod

# בדיקה
sudo systemctl status mongod
```

### יצירת משתמש MongoDB

```bash
mongosh

# בתוך MongoDB shell:
use admin
db.createUser({
  user: "bots",
  pwd: "b0t5bots",
  roles: [ { role: "readWrite", db: "bots" } ]
})
exit
```

### התקנת Nginx

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### התקנת PM2 (לניהול תהליכים)

```bash
sudo npm install -g pm2
```

---

## 📁 שלב 2: העלאת הקבצים לשרת

### אופציה א': העלאה ידנית עם SCP

**מהמחשב המקומי (PowerShell):**

```powershell
# העתק את כל הפרויקט
scp -r "C:\Users\בלומא\Desktop\בלימי ויזל\פרויקט חדש בוטים\project-bots" user@your-server-ip:~/
```

### אופציה ב': העלאה עם Git (מומלץ)

**במחשב המקומי:**

```bash
cd "C:\Users\בלומא\Desktop\בלימי ויזל\פרויקט חדש בוטים\project-bots"

# אתחול Git (אם עוד לא עשית)
git init
git add .
git commit -m "Initial commit"

# העלה ל-GitHub (צור repository חדש ב-GitHub)
git remote add origin https://github.com/YOUR-USERNAME/project-bots.git
git push -u origin main
```

**בשרת:**

```bash
cd ~
git clone https://github.com/YOUR-USERNAME/project-bots.git
```

---

## 🔧 שלב 3: הגדרת Backend

### 1. צור את תיקיית הפרויקט

```bash
sudo mkdir -p /var/www/project-bots
sudo chown -R $USER:$USER /var/www/project-bots
```

### 2. העתק את הקבצים

```bash
cp -r ~/project-bots/backend /var/www/project-bots/
cp -r ~/project-bots/frontend /var/www/project-bots/
```

### 3. הגדר את Backend

```bash
cd /var/www/project-bots/backend

# התקן חבילות
npm install --production

# צור קובץ .env
cp .env.production .env

# ערוך את קובץ .env
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
JWT_SECRET=YOUR_GENERATED_SECRET_HERE

# CORS Settings
CORS_ORIGIN=https://botswa.message.co.il
```

### 4. צור JWT Secret חזק

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

העתק את הפלט והחלף את `YOUR_GENERATED_SECRET_HERE` בקובץ `.env`.

### 5. צור תיקיית uploads (אם צריך)

```bash
mkdir -p /var/www/project-bots/backend/uploads
chmod 755 /var/www/project-bots/backend/uploads
```

### 6. הפעל את Backend עם PM2

```bash
pm2 start server.js --name "flowbot-backend"
pm2 save
pm2 startup
# הרץ את הפקודה שמוצגת (sudo...)
```

### 7. בדוק שהשרת רץ

```bash
pm2 status
pm2 logs flowbot-backend

# בדיקה ידנית
curl http://localhost:3001/api/
```

---

## 🎨 שלב 4: הגדרת Frontend

### 1. בנה את Frontend

```bash
cd /var/www/project-bots/frontend

# התקן חבילות
npm install

# בנייה לייצור
npm run build
```

הקובץ `App.tsx` כבר מוגדר לעבוד עם הדומיין האמיתי בייצור!

### 2. בדוק שהקבצים נבנו

```bash
ls -la dist/
```

אמור להיות תיקייה `dist` עם `index.html` ותיקיית `assets`.

---

## 🌐 שלב 5: הגדרת Nginx

### 1. העתק את קובץ ההגדרה

```bash
sudo cp /var/www/project-bots/nginx-config/botswa.message.co.il /etc/nginx/sites-available/botswa.message.co.il
```

### 2. צור symlink

```bash
sudo ln -s /etc/nginx/sites-available/botswa.message.co.il /etc/nginx/sites-enabled/
```

### 3. בדוק תקינות

```bash
sudo nginx -t
```

אם יש שגיאה עם SSL (כי עדיין אין תעודה), זה בסדר - נטפל בזה בשלב הבא.

### 4. הסר את ההגדרה הזמנית של Nginx

```bash
# הסר את default site אם קיים
sudo rm -f /etc/nginx/sites-enabled/default
```

---

## 🔒 שלב 6: התקנת SSL Certificate (HTTPS)

### התקן Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### קבל תעודת SSL

**חשוב:** ודא שהדומיין מצביע לשרת לפני ההרצה!

```bash
sudo certbot --nginx -d botswa.message.co.il
```

Certbot ישאל כמה שאלות:
1. **Email** - הכנס אימייל לתזכורות
2. **Terms of Service** - הקלד `Y`
3. **Redirect HTTP to HTTPS** - הקלד `2` (מומלץ)

Certbot יעדכן את קובץ ההגדרות אוטומטית!

### בדוק חידוש אוטומטי

```bash
sudo certbot renew --dry-run
```

---

## 🔍 שלב 7: בדיקות

### 1. בדוק Backend

```bash
pm2 status
pm2 logs flowbot-backend --lines 20
```

### 2. בדוק Nginx

```bash
sudo systemctl status nginx
sudo nginx -t
```

### 3. בדוק בדפדפן

פתח בדפדפן:
```
https://botswa.message.co.il
```

### 4. בדוק API

```bash
curl https://botswa.message.co.il/api/
```

### 5. בדוק לוגים

```bash
# Backend logs
pm2 logs flowbot-backend

# Nginx access logs
sudo tail -f /var/log/nginx/botswa.message.co.il-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/botswa.message.co.il-error.log
```

---

## 🔥 Firewall (אבטחה)

```bash
# התקן UFW
sudo apt install ufw -y

# אפשר פורטים נדרשים
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS

# הפעל
sudo ufw enable

# בדוק סטטוס
sudo ufw status
```

---

## 🛠️ פקודות שימושיות

### PM2 (Backend)

```bash
# סטטוס
pm2 status

# לוגים
pm2 logs flowbot-backend
pm2 logs flowbot-backend --lines 100

# הפעלה מחדש
pm2 restart flowbot-backend

# עצירה
pm2 stop flowbot-backend

# מחיקה
pm2 delete flowbot-backend

# צפייה בזמן אמת
pm2 monit
```

### Nginx

```bash
# בדיקת תקינות
sudo nginx -t

# הפעלה מחדש
sudo systemctl restart nginx

# סטטוס
sudo systemctl status nginx

# לוגים
sudo tail -f /var/log/nginx/botswa.message.co.il-access.log
sudo tail -f /var/log/nginx/botswa.message.co.il-error.log
```

### MongoDB

```bash
# סטטוס
sudo systemctl status mongod

# הפעלה מחדש
sudo systemctl restart mongod

# התחברות
mongosh "mongodb://bots:b0t5bots@127.0.0.1:27017/bots"
```

---

## 🆘 פתרון בעיות נפוצות

### שגיאה: Backend לא מתחיל

```bash
# בדוק logs
pm2 logs flowbot-backend --err

# בדוק אם הפורט תפוס
sudo netstat -tulpn | grep 3001

# בדוק משתני סביבה
pm2 env flowbot-backend

# הפעל מחדש
pm2 restart flowbot-backend
```

### שגיאה: 502 Bad Gateway

```bash
# בדוק אם Backend רץ
pm2 status

# בדוק אם Nginx רץ
sudo systemctl status nginx

# בדוק logs
pm2 logs flowbot-backend
sudo tail -50 /var/log/nginx/botswa.message.co.il-error.log
```

### שגיאה: Mongoxxxxxxxxction Failed

```bash
# בדוק אם MongoDB רץ
sudo systemctl status mongod

# התחבר ידנית
mongosh "mongodb://bots:b0t5bots@127.0.0.1:27017/bots"

# בדוק logs
sudo tail -50 /var/log/mongodb/mongod.log

# הפעל מחדש
sudo systemctl restart mongod
```

### שגיאה: SSL Certificate Failed

```bash
# ודא שהדומיין מצביע לשרת
ping botswa.message.co.il
nslookup botswa.message.co.il

# נסה שוב
sudo certbot --nginx -d botswa.message.co.il

# אם יש בעיה, הסר ונסה שוב
sudo certbot delete --cert-name botswa.message.co.il
sudo certbot --nginx -d botswa.message.co.il
```

### שגיאה: Frontend לא טוען

```bash
# בדוק שהקבצים קיימים
ls -la /var/www/project-bots/frontend/dist/

# בדוק הרשאות
sudo chown -R www-data:www-data /var/www/project-bots
sudo chmod -R 755 /var/www/project-bots

# בדוק console בדפדפן (F12)
```

---

## 🔄 עדכון הפרויקט

### עדכון Backend

```bash
cd /var/www/project-bots/backend

# גיבוי
cp .env .env.backup

# משיכת שינויים
git pull

# התקנת חבילות חדשות
npm install --production

# הפעלה מחדש
pm2 restart flowbot-backend
```

### עדכון Frontend

```bash
cd /var/www/project-bots/frontend

# משיכת שינויים
git pull

# בנייה מחדש
npm install
npm run build

# אין צורך להפעיל מחדש - Nginx משרת קבצים סטטיים
```

---

## 📊 ניטור וביצועים

### התקנת PM2 Web Dashboard (אופציונלי)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### בדיקת שימוש במשאבים

```bash
# CPU & Memory
pm2 monit

# Disk space
df -h

# Memory
free -h

# Processes
top
```

---

## 📝 סיכום מהיר (Quick Reference)

```bash
# === התקנה ראשונית ===
# 1. הכן שרת
sudo apt update && sudo apt upgrade -y
# התקן Node.js, MongoDB, Nginx, PM2

# 2. העלה קבצים
scp -r project-bots user@server:~/
sudo cp -r ~/project-bots /var/www/

# 3. Backend
cd /var/www/project-bots/backend
npm install --production
cp .env.production .env && nano .env
pm2 start server.js --name "flowbot-backend" && pm2 save

# 4. Frontend
cd /var/www/project-bots/frontend
npm install && npm run build

# 5. Nginx
sudo cp nginx-config/botswa.message.co.il /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/botswa.message.co.il /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# 6. SSL
sudo certbot --nginx -d botswa.message.co.il

# === בדיקות ===
pm2 status
sudo systemctl status nginx
curl https://botswa.message.co.il

# === לוגים ===
pm2 logs flowbot-backend
sudo tail -f /var/log/nginx/botswa.message.co.il-error.log
```

---

## 🎯 רשימת בדיקה סופית

- [ ] Node.js מותקן (v18+)
- [ ] MongoDB רץ ומוגדר עם משתמש
- [ ] Nginx מותקן ורץ
- [ ] PM2 מותקן
- [ ] הדומיין מצביע לשרת
- [ ] Backend רץ עם PM2
- [ ] Frontend בנוי ב-dist
- [ ] קובץ Nginx מועתק ל-sites-available
- [ ] Symlink נוצר ל-sites-enabled
- [ ] SSL Certificate מותקן עם Certbot
- [ ] Firewall מוגדר (UFW)
- [ ] האתר נגיש ב-https://botswa.message.co.il
- [ ] API עובד (בדיקה בדפדפן)
- [ ] התחברות למערכת עובדת

---

**במקרה של בעיות, שלח:**
1. `pm2 logs flowbot-backend --lines 50`
2. `sudo nginx -t`
3. `sudo tail -50 /var/log/nginx/botswa.message.co.il-error.log`
4. Screenshot מה-Console בדפדפן (F12)

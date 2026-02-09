# הוראות התקנת Nginx Configuration
## Nginx Setup Instructions for botswa.message.co.il

## שלב 1: העלאת הקבצים לשרת

העלה את כל תיקיית הפרויקט לשרת ל:
```bash
/var/www/project-bots/
```

## שלב 2: הגדרת Nginx

### 1. העתק את קובץ ההגדרה לתיקיית Nginx:

```bash
sudo cp nginx-config/botswa.message.co.il /etc/nginx/sites-available/botswa.message.co.il
```

### 2. צור symlink ל-sites-enabled:

```bash
sudo ln -s /etc/nginx/sites-available/botswa.message.co.il /etc/nginx/sites-enabled/
```

### 3. בדוק את תקינות ההגדרה:

```bash
sudo nginx -t
```

אם הכל תקין, תראה:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 4. הפעל מחדש את Nginx:

```bash
sudo systemctl restart nginx
```

## שלב 3: הכנת תיקיות הפרויקט

### 1. צור את תיקיית הפרויקט אם לא קיימת:

```bash
sudo mkdir -p /var/www/project-bots
sudo chown -R $USER:$USER /var/www/project-bots
```

### 2. העתק את הקבצים:

```bash
# Backend
cp -r backend /var/www/project-bots/

# Frontend (לאחר build)
cp -r frontend/dist /var/www/project-bots/frontend/
```

## שלב 4: בנייה והפעלת Frontend

```bash
cd /var/www/project-bots/frontend
npm install
npm run build
```

**חשוב!** לפני ה-build, עדכן את כתובת ה-API ב-App.tsx:

```typescript
const API_BASE = 'http://botswa.message.co.il/api';
```

## שלב 5: הפעלת Backend

```bash
cd /var/www/project-bots/backend

# התקנת חבילות
npm install --production

# הגדרת .env
cp .env.production .env
nano .env
# ודא שהערכים נכונים!

# הפעלה עם PM2
pm2 start server.js --name "flowbot-backend"
pm2 save
pm2 startup
```

## שלב 6: הגדרת DNS

**ודא שהדומיין מצביע לשרת!**

הוסף רשומת A ב-DNS:
```
Type: A
Name: botswa.message.co.il
Value: [IP של השרת שלך]
TTL: 3600
```

בדוק עם:
```bash
ping botswa.message.co.il
```

## שלב 7: התקנת SSL (HTTPS) - מומלץ מאוד!

```bash
# התקן Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# קבל תעודת SSL חינמית
sudo certbot --nginx -d botswa.message.co.il -d www.botswa.message.co.il

# Certbot יעדכן את ההגדרות אוטומטית ויפעיל HTTPS
```

## בדיקות

### 1. בדוק שהשרת רץ:
```bash
pm2 status
pm2 logs flowbot-backend
```

### 2. בדוק את Nginx:
```bash
sudo systemctl status nginx
```

### 3. בדוק בדפדפן:
```
http://botswa.message.co.il
```

### 4. בדוק את ה-API:
```bash
curl http://botswa.message.co.il/api/auth/test
```

## פתרון בעיות

### שגיאת 502 Bad Gateway
```bash
# בדוק אם Backend רץ
pm2 status

# בדוק logs
pm2 logs flowbot-backend
sudo tail -f /var/log/nginx/botswa.message.co.il-error.log
```

### שגיאת 404
```bash
# ודא שהתיקיות קיימות
ls -la /var/www/project-bots/frontend/dist

# ודא שההרשאות נכונות
sudo chown -R www-data:www-data /var/www/project-bots
sudo chmod -R 755 /var/www/project-bots
```

### Frontend לא טוען
```bash
# בדוק את console בדפדפן
# ודא ש-API_BASE מוגדר נכון ב-App.tsx
```

## סיכום מהיר

```bash
# 1. העתק קובץ nginx
sudo cp nginx-config/botswa.message.co.il /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/botswa.message.co.il /etc/nginx/sites-enabled/

# 2. בדוק והפעל מחדש
sudo nginx -t
sudo systemctl restart nginx

# 3. בנה frontend (עם API_BASE מעודכן!)
cd frontend
npm run build

# 4. העתק לשרת
sudo cp -r dist /var/www/project-bots/frontend/

# 5. הפעל backend
cd ../backend
pm2 start server.js --name "flowbot-backend"

# 6. קבל SSL
sudo certbot --nginx -d botswa.message.co.il
```

## הערות חשובות

1. **עדכן את API_BASE** בקובץ App.tsx לפני build!
2. **הגדר .env** בשרת עם JWT_SECRET חזק
3. **התקן SSL** עם Certbot לאבטחה
4. **ודא DNS** - הדומיין חייב להצביע לשרת
5. **הרשאות** - ודא שלתיקיות יש הרשאות נכונות

---

**במקרה של בעיות**, שלח את הפלט של:
```bash
sudo nginx -t
pm2 logs
sudo tail -50 /var/log/nginx/botswa.message.co.il-error.log
```

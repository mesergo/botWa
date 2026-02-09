# הוראות להעלאת הפרויקט לשרת
## Server Deployment Guide

### שלב 1: הכנת הקבצים למחשב המקומי

1. **ודאי שיש לך את כל הקבצים הנדרשים:**
   - התיקייה `backend` עם כל הקבצים
   - התיקייה `frontend` עם כל הקבצים

2. **עדכני את קובץ .env.production:**
   ```bash
   # ערכי את הקובץ backend/.env.production
   MONGODB_URI=mongodb://bots:b0t5bots@127.0.0.1:27017/bots
   JWT_SECRET=your-secret-key-change-this  # שני את זה למפתח אקראי חזק
   NODE_ENV=production
   PORT=3001
   ```

### שלב 2: העלאת הקבצים לשרת דרך PuTTY/SFTP

**אופציה א': שימוש ב-SCP (דרך PowerShell)**
```powershell
# העתק את כל תיקיית הפרויקט לשרת
scp -r "C:\Users\בלומא\Desktop\בלימי ויזל\פרויקט חדש בוטים\project-bots" user@your-server-ip:/home/user/
```

**אופציה ב': שימוש ב-WinSCP (ממשק גרפי)**
1. הורד והתקן WinSCP: https://winscp.net/
2. התחבר לשרת עם פרטי ה-SSH שלך
3. גרור את התיקיות `backend` ו-`frontend` לשרת

**אופציה ג': שימוש ב-FileZilla**
1. הורד FileZilla: https://filezilla-project.org/
2. File → Site Manager → New Site
3. Protocol: SFTP
4. Host: כתובת השרת שלך
5. העלי את התיקיות

### שלב 3: התקנה בשרת (דרך PuTTY/SSH)

1. **התחבר לשרת:**
   ```bash
   ssh user@your-server-ip
   ```

2. **נווט לתיקיית הפרויקט:**
   ```bash
   cd project-bots/backend
   ```

3. **העתק את קובץ ההגדרות לייצור:**
   ```bash
   cp .env.production .env
   # ערוך את הקובץ:
   nano .env
   # עדכן את:
   # - MONGODB_URI עם הפרטים האמיתיים של MongoDB בשרת
   # - JWT_SECRET עם מפתח חזק ואקראי
   ```

4. **התקן את החבילות:**
   ```bash
   npm install
   ```

5. **התקן PM2 (לניהול תהליכים):**
   ```bash
   npm install -g pm2
   ```

6. **הפעל את השרת:**
   ```bash
   pm2 start server.js --name "flowbot-backend"
   pm2 save
   pm2 startup
   ```

### שלב 4: הגדרת Frontend

1. **נווט לתיקיית Frontend:**
   ```bash
   cd ../frontend
   ```

2. **עדכן את כתובת ה-API בקובץ App.tsx:**
   - במחשב המקומי, ערוך את `frontend/App.tsx`
   - שנה את השורה:
   ```typescript
   const API_BASE = 'http://your-domain.com:3001/api';
   // או
   const API_BASE = 'http://your-server-ip:3001/api';
   ```

3. **בנה את ה-Frontend:**
   ```bash
   npm install
   npm run build
   ```

### שלב 5: הגדרת Nginx (Web Server)

1. **התקן Nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **צור קובץ הגדרות:**
   ```bash
   sudo nano /etc/nginx/sites-available/flowbot
   ```

3. **הוסף את ההגדרות הבאות:**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       # Frontend
       location / {
           root /home/user/project-bots/frontend/dist;
           try_files $uri $uri/ /index.html;
       }

       # Backend API
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **הפעל את האתר:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/flowbot /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### שלב 6: חיבור דומיין

**אם יש לך דומיין:**

1. **עדכן רשומות DNS:**
   - היכנס לפאנל הדומיין שלך
   - הוסף רשומת A:
     - Host: @ (או www)
     - Value: IP של השרת שלך
     - TTL: 3600

2. **המתן לעדכון DNS (עד 24 שעות)**

3. **התקן SSL עם Let's Encrypt:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

### שלב 7: פתיחת פורטים (Firewall)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw enable
```

### פקודות שימושיות:

**לבדוק סטטוס של השרת:**
```bash
pm2 status
pm2 logs flowbot-backend
```

**לאתחל את השרת:**
```bash
pm2 restart flowbot-backend
```

**לעצור את השרת:**
```bash
pm2 stop flowbot-backend
```

**לבדוק לוגים:**
```bash
pm2 logs flowbot-backend --lines 100
```

---

## רשימת בדיקות (Checklist)

- [ ] MongoDB מותקן ורץ בשרת
- [ ] Node.js גרסה 18+ מותקן
- [ ] הקבצים הועלו לשרת
- [ ] קובץ .env עודכן עם פרטי השרת
- [ ] npm install הורץ ב-backend
- [ ] השרת רץ עם PM2
- [ ] Frontend נבנה (npm run build)
- [ ] Nginx מוגדר
- [ ] דומיין מצביע לשרת
- [ ] SSL מותקן (אופציונלי אך מומלץ)
- [ ] Firewall מוגדר

## צור קשר אם יש בעיות

אם נתקעת, בדוק:
1. `pm2 logs` - לראות שגיאות
2. `sudo nginx -t` - לבדוק תקינות nginx
3. `sudo systemctl status mongodb` - לוודא ש-MongoDB רץ

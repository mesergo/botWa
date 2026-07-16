# העלאת תמונות - הדרכה מהירה 🖼️

## הבעיה
בפרודקשן, תמונות לא נטענות למרות שהאפליקציה עובדת.

## הפתרון המהיר

### בשרת (SSH):

```bash
# 1. צור תיקייה
cd /var/www/project-bots/backend
mkdir -p uploads
chmod 755 uploads

# 2. ערוך Nginx
sudo nano /etc/nginx/sites-available/flowbot
```

הוסף את זה לפני `location /api`:

```nginx
    # תמונות מועלות
    location /uploads {
        alias /var/www/project-bots/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
```

```bash
# 3. אתחל Nginx
sudo nginx -t
sudo systemctl restart nginx
```

## בדיקה

```bash
# העלה תמונה בממשק
# בדוק שהקובץ נשמר:
ls -la /var/www/project-bots/backend/uploads

# נסה לגשת לתמונה:
curl -I http://your-domain.com/uploads/filename.png
```

## איך זה עובד?

1. **Frontend** שולח תמונה כ-base64 ל-Backend
2. **Backend** שומר את התמונה כקובץ ב-`uploads/`
3. **Backend** מחזיר URL: `http://domain.com/uploads/filename.png`
4. **Nginx** משרת את התמונה ישירות (מהיר!)

## קבצי עזר

- הגדרות מלאות: `nginx-config-example.conf`
- סקריפט התקנה: `setup-uploads.sh`
- מדריך מלא: `DEPLOYMENT.md`

---

**הערה:** אם אתה משתמש בדומיין עם SSL, ודא ש-URL של התמונות הוא https:// ולא http://

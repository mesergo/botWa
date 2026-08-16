# Push Notifications Module (Firebase Cloud Messaging)

מודול התראות עצמאי ומבודד להתראות Chrome לנציגים (Agents), עם תשתית מתוכננת גם לשגרירים (Ambassadors) ומנהלים (Managers).

**סטטוס נוכחי:** תשתית בלבד. המודול **אינו מחובר** ל-Backend או ל-Frontend הקיימים.

## 1. מטרת המודול

לאפשר לנציגים לקבל התראות Push בדפדפן Chrome כאשר מגיעה הודעה חדשה בשיחה שמשויכת אליהם — גם כשהטאב אינו בפוקוס — באמצעות Firebase Cloud Messaging (FCM).

עקרונות:

- Payload מינימלי: מזהים + preview קצר בלבד (ללא תוכן מלא / רגיש).
- זהות משתמש (`userId` / `tenantId`) מגיעה מה-session בשרת בלבד.
- כשל בשליחת התראה אינו מפיל את צינור קבלת ההודעות של הבוט.
- תמיכה במספר דפדפנים למשתמש אחד + ביטול טוקנים לא תקינים.
- מניעת שליחה כפולה לפי `eventId`.

## 2. מבנה התיקיות

```text
notifications/
├── backend/                 # Node ESM (מותאם ל-backend הקיים)
│   ├── domain/              # אירועים, שגיאות, נמענים
│   ├── application/         # Service + interfaces
│   ├── infrastructure/      # Firebase, repositories, dedup
│   │   └── firebase/
│   ├── api/                 # DTOs + Express router (לא מחובר)
│   ├── types/
│   └── index.js
├── frontend/                # React + TypeScript (מותאם ל-frontend הקיים)
│   ├── firebase/
│   ├── services/
│   ├── hooks/
│   ├── components/
│   ├── types/
│   └── index.ts
├── service-worker/
│   └── firebase-messaging-sw.example.js
├── examples/
├── README.md
├── REQUIRED_INTEGRATION_CHANGES.md
└── .env.example
```

טכנולוגיות שזוהו בפרויקט (לקריאה בלבד):

| שכבה | טכנולוגיה |
|------|-----------|
| Backend | Node.js ESM, Express, Mongoose/MongoDB |
| Frontend | React, TypeScript, Vite |
| Auth | JWT (`authenticateToken`) |
| אירועים קיימים | `eventBus` (`session:update`) |

## 3. זרימת המידע

```text
הודעה נכנסת ממערכת הבוטים
        │
        ▼
נוצר ConversationMessageReceivedEvent
  (eventId, tenantId, conversationId, messageId,
   assignedAgentId, senderDisplayName, createdAt, preview קצר)
        │
        ▼
NotificationService
  ├─ dedup לפי eventId
  ├─ RecipientResolver → agent / (עתידי: ambassador, manager)
  └─ DeviceRegistrationRepository → FCM tokens פעילים
        │
        ▼
FirebaseNotificationProvider (FCM)
        │
        ▼
התראת Chrome (background SW / foreground onMessage)
        │
        ▼
לחיצה על ההתראה → ניווט לשיחה (conversationId)
```

## 4. הוראות הגדרת Firebase

1. צרו פרויקט ב-[Firebase Console](https://console.firebase.google.com/).
2. הוסיפו אפליקציית **Web** ושמרו את הקונפיג הציבורי (apiKey, authDomain, projectId, messagingSenderId, appId).
3. הפעילו **Cloud Messaging**.
4. צרו **Web Push certificates (VAPID key)** והעתיקו את המפתח הציבורי.
5. ב-Project Settings → Service accounts צרו מפתח ל-Admin SDK (client email + private key) — **רק לשרת**.
6. אל תשימו את ה-private key ב-Frontend או ב-Service Worker.

## 5. משתני environment הנדרשים

ראו גם `.env.example`. שמות בלבד (ללא ערכים אמיתיים בקוד):

**Backend (Admin):**

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

**Frontend (Web / Vite):**

- `VITE_FIREBASE_API_KEY` (או `FIREBASE_API_KEY`)
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_PUBLIC_KEY`

## 6. חיבור עתידי ל-Backend הקיים

1. התקינו `firebase-admin` ב-`backend/`.
2. אתחלו את Firebase Admin פעם אחת בעליית השרת (`backend/server.js`) דרך `initFirebaseAdmin()`.
3. צרו instance של `NotificationService` עם:
   - `FirebaseNotificationProvider`
   - `DefaultRecipientResolver` (או resolver מותאם)
   - `MongooseDeviceRegistrationRepository`
   - `InMemoryEventDeduplicator` (או Redis בעתיד)
4. הרכיבו את ה-router:

   `app.use('/api/push-notifications', createPushNotificationRouter({ notificationService, authenticate: authenticateToken }))`

5. פרסמו אירוע אחרי שמירת הודעה ב-`chatController` (ליד `eventBus.emit('session:update', ...)`) באמצעות:

   `void notificationService.handleConversationMessageReceived(...)`

   שימו לב ל-`void` / try-isolated — השירות כבר מבודד שגיאות, אך אין לחסום את ה-webhook.

פרטים מדויקים: `REQUIRED_INTEGRATION_CHANGES.md` ו-`examples/backend-integration.example.ts`.

## 7. חיבור עתידי ל-Frontend הקיים

1. התקינו `firebase` ב-`frontend/`.
2. הוסיפו משתני `VITE_FIREBASE_*` ל-env של הפרונט.
3. העתיקו את ה-Service Worker:

   מ: `notifications/service-worker/firebase-messaging-sw.example.js`  
   אל: `frontend/public/firebase-messaging-sw.js`  
   ועדכנו בו את ערכי הקונפיג הציבוריים.

4. במסך מתאים לנציגים (למשל אזור הגדרות ב-`SessionsPage`) הוסיפו:

   - `createDeviceRegistrationService({ apiBaseUrl: ..., getAccessToken: ... })`
   - `usePushNotifications(...)`
   - `<EnableNotificationsButton />`

5. בקשת הרשאת Notification תתרחש **רק** בלחיצה על הכפתור.

פרטים: `examples/frontend-integration.example.ts`.

## 8. הוספת שגרירים בעתיד

1. הרחיבו את `RecipientResolver` כך שיחזיר גם `{ type: 'ambassador', ... }` לפי כללי השיוך העסקיים.
2. ודאו ששגרירים יכולים לרשום דפדפן דרך אותם endpoints (הזהות עדיין מה-session).
3. אין צורך בשינוי פרוטוקול FCM — אותו `NotificationService` משרת את כל סוגי הנמענים.
4. אפשר להתחיל עם feature flag ב-`DefaultRecipientResolver({ includeAmbassadors: true })` אחרי מימוש הלוגיקה.

## 9. Placeholders לעומת מוכן לשימוש

| חלק | סטטוס |
|-----|--------|
| `ConversationMessageReceivedEvent` + validation | מוכן |
| `NotificationService` (כולל בידוד שגיאות + dedup) | מוכן |
| `FirebaseNotificationProvider` | מוכן (דורש `firebase-admin` + env) |
| `DefaultRecipientResolver` (agent בלבד) | מוכן חלקית — ambassadors/managers placeholders |
| `InMemoryDeviceRegistrationRepository` | מוכן לבדיקות מקומיות |
| `MongooseDeviceRegistrationRepository` + schema | מוכן אך לא רשום באפליקציה |
| Express router / DTOs | מוכנים אך לא מורכבים ב-`server.js` |
| Frontend services / hook / button | מוכנים אך לא מיובאים למסכים |
| Service Worker | דוגמה בלבד — לא ב-`public/` |
| חיבור ל-`chatController` / `eventBus` | לא מחובר |

## 10. הוראות בדיקה ידנית (אחרי אינטגרציה)

1. הגדירו env לשרת ולפרונט.
2. העתיקו את ה-SW ל-`frontend/public/firebase-messaging-sw.js`.
3. התחברו כנציג (Chrome).
4. לחצו על **הפעל התראות Chrome** ואשרו הרשאה.
5. ודאו ש-`POST /api/push-notifications/devices/register` מחזיר success.
6. שלחו הודעת בדיקה לשיחה שמשויכת לנציג.
7. בדקו התראה בטאב ברקע, ו-foreground כשהטאב פתוח.
8. לחצו על ההתראה וודאו ניווט לשיחה.
9. בדקו ששליחה כפולה עם אותו `eventId` לא יוצרת שתי התראות.
10. בדקו שטוקן לא תקין מסומן כ-inactive.

## אבטחה — תזכורת

- אין לקבל `userId` / `tenantId` מה-Frontend כמקור סמכות.
- אין לשמור Firebase Admin private key בפרונט.
- אין לשלוח תוכן מלא של הודעה דרך FCM.
- יש לתמוך במספר דפדפנים ובביטול רישומים ישנים/לא תקינים.

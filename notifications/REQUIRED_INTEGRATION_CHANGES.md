# REQUIRED_INTEGRATION_CHANGES

רשימת שינויים נדרשים לאינטגרציה מלאה.  
**לא בוצעו בשלב זה** — התשתית תחת `notifications/` בלבד.

---

## 1. Dependencies להתקנה

### Backend (`backend/package.json`)

```bash
npm install firebase-admin
```

### Frontend (`frontend/package.json`)

```bash
npm install firebase
```

אין צורך לשנות lock files עד שלב האינטגרציה המפורש.

---

## 2. קבצים קיימים שיש לערוך

| קובץ | שינוי נדרש |
|------|------------|
| `backend/package.json` | הוספת dependency `firebase-admin` |
| `frontend/package.json` | הוספת dependency `firebase` |
| `backend/server.js` | אתחול Firebase Admin + mount ל-router של push notifications |
| `backend/controllers/chatController.js` | פרסום `ConversationMessageReceivedEvent` אחרי הודעה חדשה |
| קובץ env של Backend (למשל `backend/.env`) | הוספת משתני Firebase Admin |
| קובץ env של Frontend (למשל `frontend/.env`) | הוספת משתני `VITE_FIREBASE_*` |
| מסך נציג ב-Frontend (מומלץ: `frontend/components/SessionsPage.tsx` או אזור הגדרות נציג) | הוספת `EnableNotificationsButton` |
| `frontend/public/` | הוספת קובץ חדש `firebase-messaging-sw.js` (העתקה מהדוגמה) |

אופציונלי בהמשך:

| קובץ | שינוי |
|------|--------|
| `backend/utils/eventBus.js` | אפשר להוסיף אירוע ייעודי `conversation:message` במקום קריאה ישירה מה-controller |
| `backend/middleware/auth.js` | אם נדרש helper ייעודי ל-`tenantId` לנציגים (`manager_id` / owner) |

---

## 3. Imports שיהיה צורך להוסיף

### `backend/server.js`

```js
import {
  initFirebaseAdmin,
  createPushNotificationRouter,
  NotificationService,
  FirebaseNotificationProvider,
  DefaultRecipientResolver,
  MongooseDeviceRegistrationRepository,
  InMemoryEventDeduplicator,
} from '../notifications/backend/index.js';
import { authenticateToken } from './middleware/auth.js'; // כבר קיים — לשימוש ב-mount
```

### `backend/controllers/chatController.js`

```js
import { notificationService } from '..//* path to shared wired instance */';
// או import מהמקום שבו ה-service נוצר ב-server.js / module נפרד
```

### מסך Frontend (למשל SessionsPage)

```ts
import {
  createDeviceRegistrationService,
  usePushNotifications,
  EnableNotificationsButton,
} from '../../notifications/frontend';
```

---

## 4. היכן לפרסם את אירוע ההודעה ממערכת הבוטים

**מיקום מומלץ:** `backend/controllers/chatController.js`

ליד הקריאות הקיימות:

```js
eventBus.emit('session:update', { userId: String(user._id), phone: sender });
```

(מופיעות במספר מקומות בקובץ — כל נקודה שבה נשמרת הודעת לקוח נכנסת רלוונטית).

**דפוס מומלץ:**

```js
void notificationService.handleConversationMessageReceived({
  eventId: `msg_${messageId}`,
  tenantId: String(accountOwnerId),
  conversationId: String(sessionId),
  messageId: String(messageId),
  assignedAgentId: assignedAgentId ? String(assignedAgentId) : null,
  senderDisplayName: displayName || 'לקוח',
  createdAt: new Date().toISOString(),
  previewText: truncatedPreview, // לא גוף מלא
});
```

אל תחסמו את ה-webhook ב-await ארוך; השירות מבודד שגיאות, אך עדיין מומלץ `void` / background.

---

## 5. היכן לרשום את routes של מודול ההתראות

**קובץ:** `backend/server.js`  
**אחרי** חיבור ה-DB ורישום שאר ה-routes.

```js
app.use(
  '/api/push-notifications',
  createPushNotificationRouter({
    notificationService,
    authenticate: authenticateToken,
  })
);
```

**חשוב:** לא להשתמש ב-`/api/notifications` — הנתיב הזה כבר תפוס ע\"י התראות in-app קיימות (`backend/routes/notificationRoutes.js`).

Endpoints:

- `POST /api/push-notifications/devices/register`
- `POST /api/push-notifications/devices/unregister`

---

## 6. היכן לאתחל Firebase Admin

**קובץ:** `backend/server.js` בתוך `startServer()`, אחרי `connectDB()` (או לפני הרכבת ה-router).

```js
await initFirebaseAdmin(); // קורא FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY
```

אל תשימו credentials בקוד — רק ב-env.

---

## 7. היכן להוסיף את כפתור הפעלת ההתראות

**מומלץ:** UI של נציגים — `frontend/components/SessionsPage.tsx`  
(או פאנל הגדרות נציג / אזור בר בראש המסך לנציגים בלבד).

תנאים:

- רק אחרי לחיצה מפורשת של המשתמש.
- מוצג למשתמשי `rep` / תפקידים רלוונטיים.
- לא להוסיף route חדש אם ניתן לשלב במסך קיים.

---

## 8. היכן למקם את ה-Service Worker

| מקור (קיים במודול) | יעד באינטגרציה |
|--------------------|----------------|
| `notifications/service-worker/firebase-messaging-sw.example.js` | `frontend/public/firebase-messaging-sw.js` |

לאחר ההעתקה:

1. החליפו את ערכי `REPLACE_WITH_*` בקונפיג הציבורי.
2. ודאו שהקובץ נגיש ב-`/firebase-messaging-sw.js`.
3. רשמו אותו מ-`navigator.serviceWorker.register('/firebase-messaging-sw.js')` מתוך ה-hook / כפתור.

---

## 9. משתני environment שיהיה צורך להוסיף

ראו `notifications/.env.example`.

Backend:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Frontend:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_PUBLIC_KEY`

---

## 10. Migrations

הפרויקט משתמש ב-**Mongoose** ללא מערכת migrations פורמלית.

נדרש:

- שימוש ב-schema החדש `PushDeviceRegistration`  
  (`notifications/backend/infrastructure/models/DeviceRegistration.model.js`)
- MongoDB ייצור את ה-collection אוטומטית ב-upsert הראשון
- אינדקסים מוגדרים בסכמה: `fcmToken` (unique), `{ userId, tenantId, active }`

אם בעתיד תתווסף מערכת migrations — יש ליצור migration ליצירת ה-collection/אינדקסים במפורש.

---

## 11. שינויים נוספים לאינטגרציה מלאה

1. **מיפוי tenantId לנציגים:** כיום במערכת נציגים רואים נתונים דרך `manager_id` / `getEffectiveUserId`. יש ליישר את `resolveSessionIdentity` עם אותה לוגיקה.
2. **שיוך נציג לשיחה:** לוודא מאיפה מגיע `assignedAgentId` (Contact.assigned_to / session assignment) ולהעביר אותו לאירוע.
3. **מדיניות מתי לשלוח:** למשל רק כשהשיחה ב-agent mode, רק לנציג משויך, לא לסימולטור.
4. **Dedup מרובה instances:** `InMemoryEventDeduplicator` מספיק ל-process בודד; לפריסה מרובת instances להחליף ב-Redis/DB.
5. **Ambassadors / Managers:** לממש לוגיקה ב-`RecipientResolver` ולהפעיל feature flags.
6. **ניווט בלחיצה:** ליישר את `clickAction` עם ה-routing האמיתי של `SessionsPage` (query param / state).
7. **CORS / HTTPS:** Push ב-Chrome דורש הקשר מאובטח (HTTPS) בפרודקשן.
8. **בדיקות:** טסט ידני לפי README §10; בהמשך unit tests ל-dedup / validation / isolation.
9. **תיעוד ops:** סיבוב מפתחות Firebase, ניטור כשלי FCM, ניקוי טוקנים ישנים (cron אופציונלי).

---

## סיכום

שלב נוכחי = תשתית מבודדת תחת `notifications/` בלבד.  
שלב הבא = לבצע את השינויים ברשימה זו במפורש, בלי לחרוג מההיקף שיוגדר אז.

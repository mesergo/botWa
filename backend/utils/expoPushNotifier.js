/**
 * expoPushNotifier.js
 * Bridges the in-process eventBus 'notification:new' events (session transfer
 * / case1 / case2 reminders) to Expo push. Registered once during server
 * bootstrap so we don't duplicate the hook across the 3 emit sites in
 * sessionController.js.
 */
import eventBus from './eventBus.js';
import { sendExpoPushToUser } from './expoPush.js';

let _registered = false;

export function registerExpoPushNotifier() {
  if (_registered) return;
  _registered = true;

  eventBus.on('notification:new', ({ userId, notification }) => {
    if (!userId || !notification) return;
    try {
      void sendExpoPushToUser(userId, {
        title: notification.from_user_name || 'הודעה חדשה',
        body: notification.target_label || 'עדכון שיחה',
        data: { sessionId: notification.session_id },
      }).catch((err) => {
        console.error('[EXPO-PUSH] notification:new isolated error:', err?.message || err);
      });
    } catch (err) {
      console.error('[EXPO-PUSH] notification:new isolated error:', err?.message || err);
    }
  });
}

/**
 * Notifications-module bridge to the host Backend's Firebase Admin bootstrap.
 * Keeping package imports under backend/ ensures Node resolves backend/node_modules.
 */

export {
  initFirebaseAdmin,
  isFirebaseAdminReady,
  getFirebaseAdminInitError,
  __resetFirebaseAdminForTests,
} from '../../../../backend/config/firebaseAdmin.js';

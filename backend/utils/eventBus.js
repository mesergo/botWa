import { EventEmitter } from 'events';

/**
 * In-process event bus for real-time SSE push.
 * Emitted events:
 *   'session:update' — { userId: string, phone: string }
 *     Fired whenever a session changes (new message, agent mode, status, etc.)
 *     so SSE listeners can push an update to the relevant browser client.
 */
const eventBus = new EventEmitter();

// Remove the default limit (10) — we expect one listener per connected browser tab
eventBus.setMaxListeners(0);

export default eventBus;

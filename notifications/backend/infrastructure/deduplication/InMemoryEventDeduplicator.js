/**
 * In-memory event deduplicator — prevents duplicate pushes for the same eventId.
 * Replace with Redis / DB-backed store during integration if running multiple instances.
 */

export class InMemoryEventDeduplicator {
  /**
   * @param {{ ttlMs?: number, maxSize?: number }} [options]
   */
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
    this.maxSize = options.maxSize ?? 10_000;
    /** @type {Map<string, number>} */
    this._seen = new Map();
  }

  _prune(now) {
    for (const [key, expiresAt] of this._seen.entries()) {
      if (expiresAt <= now) this._seen.delete(key);
    }
    if (this._seen.size <= this.maxSize) return;
    const overflow = this._seen.size - this.maxSize;
    const keys = this._seen.keys();
    for (let i = 0; i < overflow; i += 1) {
      const next = keys.next();
      if (next.done) break;
      this._seen.delete(next.value);
    }
  }

  /**
   * @param {string} eventId
   * @returns {boolean} true if this eventId was already processed
   */
  has(eventId) {
    if (!eventId) return false;
    const expiresAt = this._seen.get(eventId);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      this._seen.delete(eventId);
      return false;
    }
    return true;
  }

  /**
   * Mark eventId as processed. Returns false if it was already seen (duplicate).
   * @param {string} eventId
   * @returns {boolean} true if newly recorded, false if duplicate
   */
  tryClaim(eventId) {
    if (!eventId) return false;
    const now = Date.now();
    this._prune(now);
    if (this.has(eventId)) return false;
    this._seen.set(eventId, now + this.ttlMs);
    return true;
  }
}

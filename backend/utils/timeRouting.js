// Shared helpers for the "time_range" mode of the action_time_routing node.
// Value string format: "H[:M]-H[:M]", e.g. "8:30-16:45".
// Backward compatible with the legacy format without minutes, e.g. "8-16".

/**
 * Parse a time range Option value string into a range object.
 * Supports both the new "H:M-H:M" format and the legacy "H-H" format.
 * @param {string} value
 * @returns {{ fromHour: number, fromMinute: number, toHour: number, toMinute: number }}
 */
export function parseTimeRangeValue(value) {
  const [fromPart, toPart] = String(value || '').split('-');

  const parsePart = (part) => {
    const [hourStr, minuteStr] = String(part || '').split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    return {
      hour: Number.isNaN(hour) ? undefined : hour,
      minute: Number.isNaN(minute) ? 0 : minute
    };
  };

  const from = parsePart(fromPart);
  const to = parsePart(toPart);

  return {
    fromHour: from.hour !== undefined ? from.hour : 0,
    fromMinute: from.minute,
    toHour: to.hour !== undefined ? to.hour : 23,
    toMinute: to.minute
  };
} 

/**
 * Format a time range object into the "H:M-H:M" Option value string.
 * @param {{ fromHour: number, fromMinute?: number, toHour: number, toMinute?: number }} range
 * @returns {string}
 */
export function formatTimeRangeValue(range) {
  const fromHour = parseInt(range?.fromHour, 10) || 0;
  const fromMinute = parseInt(range?.fromMinute, 10) || 0;
  const toHour = parseInt(range?.toHour, 10) || 0;
  const toMinute = parseInt(range?.toMinute, 10) || 0;
  return `${fromHour}:${fromMinute}-${toHour}:${toMinute}`;
}

/**
 * Check whether the given current hour/minute falls within the given range,
 * supporting ranges that cross midnight (e.g. 22:30-6:15).
 * @param {number} currentHour
 * @param {number} currentMinute
 * @param {{ fromHour: number, fromMinute?: number, toHour: number, toMinute?: number }} range
 * @returns {boolean}
 */
export function matchTimeRange(currentHour, currentMinute, range) {
  const fromHour = parseInt(range?.fromHour, 10) || 0;
  const fromMinute = parseInt(range?.fromMinute, 10) || 0;
  const toHour = parseInt(range?.toHour, 10) || 23;
  const toMinute = parseInt(range?.toMinute, 10) || 0;

  const current = currentHour * 60 + currentMinute;
  const from = fromHour * 60 + fromMinute;
  const to = toHour * 60 + toMinute;

  if (from <= to) {
    return current >= from && current < to;
  }
  return current >= from || current < to;
}

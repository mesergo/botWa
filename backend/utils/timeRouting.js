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

/**
 * Check whether the given date string (YYYY-MM-DD) falls within the given date range
 * (inclusive on both ends).
 * @param {string} dateStr
 * @param {{ fromDate: string, toDate: string }} range
 * @returns {boolean}
 */
export function matchDateRange(dateStr, range) {
  const fromDate = range?.fromDate;
  const toDate = range?.toDate;
  if (!fromDate || !toDate) return false;
  return dateStr >= fromDate && dateStr <= toDate;
}

/**
 * Check whether the given weekday (0=Sunday..6=Saturday) falls within the given weekday
 * range, supporting ranges that wrap around the week (e.g. Fri-Mon).
 * @param {number} day
 * @param {{ fromDay: number, toDay: number }} range
 * @returns {boolean}
 */
export function matchWeekdayRange(day, range) {
  const fromDay = Number.isInteger(range?.fromDay) ? range.fromDay : 0;
  const toDay = Number.isInteger(range?.toDay) ? range.toDay : 6;
  if (fromDay <= toDay) {
    return day >= fromDay && day <= toDay;
  }
  return day >= fromDay || day <= toDay;
}

/**
 * Derive the Israel-local date/time parts used by the condition matchers from a JS Date
 * that already represents Israel local time (e.g. `new Date(now.toLocaleString('en-US',
 * { timeZone: 'Asia/Jerusalem' }))`).
 * @param {Date} israelTime
 */
function getIsraelTimeParts(israelTime) {
  const dateStr = [
    israelTime.getFullYear(),
    String(israelTime.getMonth() + 1).padStart(2, '0'),
    String(israelTime.getDate()).padStart(2, '0')
  ].join('-');
  return {
    dateStr,
    hour: israelTime.getHours(),
    minute: israelTime.getMinutes(),
    day: israelTime.getDay()
  };
}

/**
 * Check whether a single condition (kind: time | date | weekday) matches the given
 * Israel-local time.
 * @param {{ kind: 'time'|'date'|'weekday' }} condition
 * @param {Date} israelTime
 * @returns {boolean}
 */
export function matchCondition(condition, israelTime) {
  const { dateStr, hour, minute, day } = getIsraelTimeParts(israelTime);
  switch (condition?.kind) {
    case 'date':
      return matchDateRange(dateStr, condition);
    case 'weekday':
      return matchWeekdayRange(day, condition);
    case 'time':
    default:
      return matchTimeRange(hour, minute, condition);
  }
}

/**
 * AND all conditions of a branch together.
 * @param {Array} conditions
 * @param {Date} israelTime
 * @returns {boolean}
 */
export function matchConditions(conditions, israelTime) {
  if (!Array.isArray(conditions) || conditions.length === 0) return false;
  return conditions.every((condition) => matchCondition(condition, israelTime));
}

/**
 * Find the index of the first branch whose conditions all match (OR across branches).
 * @param {Array<{ conditions: Array }>} branches
 * @param {Date} israelTime
 * @returns {number} matched branch index, or -1 if none matched
 */
export function findMatchedBranchIndex(branches, israelTime) {
  if (!Array.isArray(branches)) return -1;
  for (let i = 0; i < branches.length; i += 1) {
    if (matchConditions(branches[i]?.conditions, israelTime)) return i;
  }
  return -1;
}

/**
 * Serialize a branch's conditions array into the Option.value JSON string.
 * @param {Array} conditions
 * @returns {string}
 */
export function serializeBranchConditions(conditions) {
  return JSON.stringify(conditions || []);
}

/**
 * Parse an Option's stored value/operator into a conditions array, supporting both the
 * new unified 'compound_range' JSON format and the legacy per-mode operators
 * ('time_range' / 'date_range' / 'weekday_range').
 * @param {string} value
 * @param {string} operator
 * @returns {Array}
 */
export function parseBranchValue(value, operator) {
  if (operator === 'compound_range') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (operator === 'date_range') {
    const [fromDate, toDate] = String(value || '').split('|');
    return [{ kind: 'date', fromDate, toDate }];
  }
  if (operator === 'weekday_range') {
    const [fromDay, toDay] = String(value || '').split('-').map(Number);
    return [{ kind: 'weekday', fromDay, toDay }];
  }
  // Legacy 'time_range' (and any unknown operator) falls back to the time parser.
  return [{ kind: 'time', ...parseTimeRangeValue(value) }];
}

/**
 * Reconstruct the `timeRoutingBranches` array for an action_time_routing node from its
 * Option rows (in Mongo insertion order), handling both new compound_range rows and
 * legacy time_range/date_range/weekday_range rows transparently.
 * @param {Array} nodeOptions - Option docs for this widget (already filtered by widget_id)
 * @returns {{ timeRoutingBranches: Array<{ conditions: Array }> }}
 */
export function reconstructTimeRoutingBranches(nodeOptions) {
  const timeRoutingBranches = (nodeOptions || [])
    .filter(isTimeRoutingBranchOption)
    .map((o) => ({ conditions: parseBranchValue(o.value, o.operator) }));
  return { timeRoutingBranches };
}

/**
 * Operators that represent a routing branch (as opposed to the 'default' option) on an
 * action_time_routing node, across both the new unified format and legacy per-mode ones.
 */
export const TIME_ROUTING_BRANCH_OPERATORS = ['compound_range', 'time_range', 'date_range', 'weekday_range'];

/**
 * @param {{ operator?: string }} option
 * @returns {boolean}
 */
export function isTimeRoutingBranchOption(option) {
  return TIME_ROUTING_BRANCH_OPERATORS.includes(option?.operator);
}

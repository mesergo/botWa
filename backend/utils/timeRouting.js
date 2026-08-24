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

// ── Compound branches (kind: time | date | weekday, AND-ed together) ──────────
//
// A branch is persisted as a single Option row on the action_time_routing widget:
//   operator 'compound_range' -> value is the JSON-encoded conditions array.
// The three legacy single-condition operators are still read here so bots saved
// before compound branches existed keep routing correctly.
//
// The matching half of this file is mirrored in frontend/utils/timeRouting.ts
// (used by the Simulator) — keep both in sync.

export const TIME_ROUTING_BRANCH_OPERATORS = ['compound_range', 'time_range', 'date_range', 'weekday_range'];

const ISO_DATE_PAIR_REGEX = /^(\d{4}-\d{2}-\d{2})\s*(?:~|\.\.|,|-)\s*(\d{4}-\d{2}-\d{2})$/;

/** True for options that represent an indexed branch handle (option-<n>), excluding 'default'. */
export function isTimeRoutingBranchOption(option) {
  return TIME_ROUTING_BRANCH_OPERATORS.includes(option?.operator);
}

/**
 * Encode a branch's conditions into the Option.value string.
 * @param {Array<object>} conditions
 * @returns {string}
 */
export function serializeBranchConditions(conditions) {
  return JSON.stringify(Array.isArray(conditions) ? conditions : []);
}

function parseLegacyConditions(option) {
  const value = String(option?.value || '');

  if (option?.operator === 'weekday_range') {
    const [fromDay, toDay] = value.split('-').map((part) => parseInt(part, 10));
    return [{
      kind: 'weekday',
      fromDay: Number.isNaN(fromDay) ? 0 : fromDay,
      toDay: Number.isNaN(toDay) ? 6 : toDay
    }];
  }

  if (option?.operator === 'date_range') {
    const match = value.match(ISO_DATE_PAIR_REGEX);
    if (!match) return [];
    return [{ kind: 'date', fromDate: match[1], toDate: match[2] }];
  }

  return [{ kind: 'time', ...parseTimeRangeValue(value) }];
}

/**
 * Decode one branch option back into its conditions array.
 * @param {{ operator?: string, value?: string }} option
 * @returns {Array<object>}
 */
export function parseBranchConditions(option) {
  const value = String(option?.value || '').trim();

  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not valid JSON after all — fall through to the legacy readers.
    }
  }

  return parseLegacyConditions(option);
}

/**
 * Rebuild the node's `timeRoutingBranches` editor data from its saved options.
 * Returned as an object so callers can spread it straight into `node.data`.
 * @param {Array<object>} nodeOptions
 * @returns {{ timeRoutingBranches: Array<{ conditions: Array<object> }> }}
 */
export function reconstructTimeRoutingBranches(nodeOptions) {
  const branches = (Array.isArray(nodeOptions) ? nodeOptions : [])
    .filter(isTimeRoutingBranchOption)
    .map((option) => ({ conditions: parseBranchConditions(option) }));

  return { timeRoutingBranches: branches };
}

/** Check whether an ISO date string (YYYY-MM-DD) falls within the range, inclusive. */
export function matchDateRange(dateStr, range) {
  if (!range?.fromDate || !range?.toDate) return false;
  return dateStr >= range.fromDate && dateStr <= range.toDate;
}

/** Check whether a weekday (0=Sunday..6=Saturday) falls within the range, wrapping over Saturday. */
export function matchWeekdayRange(day, range) {
  const fromDay = Number.isInteger(range?.fromDay) ? range.fromDay : 0;
  const toDay = Number.isInteger(range?.toDay) ? range.toDay : 6;

  if (fromDay <= toDay) {
    return day >= fromDay && day <= toDay;
  }
  return day >= fromDay || day <= toDay;
}

/** Check a single condition against an Israel-local Date. */
export function matchCondition(condition, israelTime) {
  const dateStr = [
    israelTime.getFullYear(),
    String(israelTime.getMonth() + 1).padStart(2, '0'),
    String(israelTime.getDate()).padStart(2, '0')
  ].join('-');

  switch (condition?.kind) {
    case 'date':
      return matchDateRange(dateStr, condition);
    case 'weekday':
      return matchWeekdayRange(israelTime.getDay(), condition);
    case 'time':
    default:
      return matchTimeRange(israelTime.getHours(), israelTime.getMinutes(), condition);
  }
}

/** AND all of a branch's conditions together. An empty branch never matches. */
export function matchConditions(conditions, israelTime) {
  if (!Array.isArray(conditions) || conditions.length === 0) return false;
  return conditions.every((condition) => matchCondition(condition, israelTime));
}

/**
 * Index of the first branch whose conditions all match (OR across branches),
 * or -1 when none do — the caller then routes to the 'default' handle.
 * @returns {number}
 */
export function findMatchedBranchIndex(branches, israelTime) {
  if (!Array.isArray(branches)) return -1;
  for (let i = 0; i < branches.length; i += 1) {
    if (matchConditions(branches[i]?.conditions, israelTime)) return i;
  }
  return -1;
}

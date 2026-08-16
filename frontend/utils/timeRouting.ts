// Frontend mirror of backend/utils/timeRouting.js's compound-condition matching helpers.
// Pure functions, no I/O — shared by the Simulator (and any future live-preview badge).
import { TimeRoutingCondition } from '../types';

/**
 * Check whether the given current hour/minute falls within the given time range,
 * supporting ranges that cross midnight (e.g. 22:30-6:15).
 */
export function matchTimeRange(
  currentHour: number,
  currentMinute: number,
  range: { fromHour?: number; fromMinute?: number; toHour?: number; toMinute?: number }
): boolean {
  const fromHour = parseInt(String(range?.fromHour), 10) || 0;
  const fromMinute = parseInt(String(range?.fromMinute), 10) || 0;
  const toHour = parseInt(String(range?.toHour), 10) || 23;
  const toMinute = parseInt(String(range?.toMinute), 10) || 0;

  const current = currentHour * 60 + currentMinute;
  const from = fromHour * 60 + fromMinute;
  const to = toHour * 60 + toMinute;

  if (from <= to) {
    return current >= from && current < to;
  }
  return current >= from || current < to;
}

/** Check whether the given date string (YYYY-MM-DD) falls within the given date range (inclusive). */
export function matchDateRange(dateStr: string, range: { fromDate?: string; toDate?: string }): boolean {
  const fromDate = range?.fromDate;
  const toDate = range?.toDate;
  if (!fromDate || !toDate) return false;
  return dateStr >= fromDate && dateStr <= toDate;
}

/** Check whether the given weekday (0=Sunday..6=Saturday) falls within the given weekday range. */
export function matchWeekdayRange(day: number, range: { fromDay?: number; toDay?: number }): boolean {
  const fromDay = Number.isInteger(range?.fromDay) ? (range.fromDay as number) : 0;
  const toDay = Number.isInteger(range?.toDay) ? (range.toDay as number) : 6;
  if (fromDay <= toDay) {
    return day >= fromDay && day <= toDay;
  }
  return day >= fromDay || day <= toDay;
}

/** Check whether a single condition (kind: time | date | weekday) matches the given Israel-local time. */
export function matchCondition(condition: TimeRoutingCondition, israelTime: Date): boolean {
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

/** AND all conditions of a branch together. */
export function matchConditions(conditions: TimeRoutingCondition[] | undefined, israelTime: Date): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return false;
  return conditions.every((condition) => matchCondition(condition, israelTime));
}

/** Find the index of the first branch whose conditions all match (OR across branches). */
export function findMatchedBranchIndex(
  branches: Array<{ conditions: TimeRoutingCondition[] }> | undefined,
  israelTime: Date
): number {
  if (!Array.isArray(branches)) return -1;
  for (let i = 0; i < branches.length; i += 1) {
    if (matchConditions(branches[i]?.conditions, israelTime)) return i;
  }
  return -1;
}

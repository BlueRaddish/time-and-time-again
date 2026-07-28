/**
 * TimePoint construction and conversion.
 *
 * Storage format depends on precision, deliberately:
 *
 *   precision 'date' → `YYYY-MM-DD`, no time component, no zone
 *   precision 'time' → full ISO 8601 in UTC (`toISOString()`)
 *
 * Storing a date-only value as a UTC instant is the classic source of off-by-one-day bugs:
 * "due the 5th" saved at local midnight becomes the 4th for anyone west of UTC. Keeping the
 * two forms distinct means a date-only Thing has no zone to be wrong about, while a timed
 * Thing keeps a real instant that converts correctly for display.
 */

import type { Precision, TimePoint } from '@/types/thing';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A date-only TimePoint from a local Date, using that Date's *local* calendar day. */
export function dateOnly(d: Date): TimePoint {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { at: `${year}-${month}-${day}`, precision: 'date' };
}

/** A time-precise TimePoint from a local Date. */
export function atTime(d: Date): TimePoint {
  return { at: d.toISOString(), precision: 'time' };
}

export function timePoint(d: Date, precision: Precision): TimePoint {
  return precision === 'date' ? dateOnly(d) : atTime(d);
}

/**
 * Back to a local Date. Date-only values resolve to local midnight of that calendar day,
 * which is what every comparison in the app wants.
 */
export function toDate(tp: TimePoint): Date {
  if (DATE_ONLY.test(tp.at)) {
    const [year, month, day] = tp.at.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(tp.at);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Sort key. Date-only sorts to the start of its day, so it leads that day's timed items. */
export function sortValue(tp: TimePoint | null): number {
  return tp ? toDate(tp).getTime() : Number.POSITIVE_INFINITY;
}

/**
 * Display formatting for TimePoints.
 *
 * Precision is honoured strictly: a date-only point never renders a time it doesn't have.
 * That distinction is the whole reason precision is stored per-field, and showing "12:00 AM"
 * for "due sometime Friday" would throw it away.
 */

import { addDays, isSameDay, startOfDay, toDate } from '@/lib/time';
import type { Thing, TimePoint } from '@/types/thing';

function dayLabel(date: Date, now: Date): string {
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, addDays(now, 1))) return 'Tomorrow';
  if (isSameDay(date, addDays(now, -1))) return 'Yesterday';

  const withinWeek = Math.abs(startOfDay(date).getTime() - startOfDay(now).getTime()) < 6 * 864e5;
  if (withinWeek) return date.toLocaleDateString(undefined, { weekday: 'long' });

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function clockLabel(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatTimePoint(tp: TimePoint, now: Date = new Date()): string {
  const date = toDate(tp);
  const day = dayLabel(date, now);
  return tp.precision === 'date' ? day : `${day}, ${clockLabel(date)}`;
}

/** Full day heading, for calendar group headers. */
export function formatDayHeading(date: Date, now: Date = new Date()): string {
  const relative = dayLabel(date, now);
  const absolute = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return relative === absolute ? relative : `${relative} · ${absolute}`;
}

/**
 * The time summary shown on a row, reading naturally per derived type:
 *
 *   Event  "Today, 3:00 PM – 4:00 PM"  (collapsed when both ends share a day)
 *   Task   "due Friday"
 *   Anchor "from Today, 3:00 PM"
 *   Note   ""
 */
export function formatThingTime(
  thing: Pick<Thing, 'start' | 'end'>,
  now: Date = new Date()
): string {
  const { start, end } = thing;

  if (start && end) {
    const startDate = toDate(start);
    const endDate = toDate(end);
    const sameDay = isSameDay(startDate, endDate);

    if (sameDay && start.precision === 'time' && end.precision === 'time') {
      return `${dayLabel(startDate, now)}, ${clockLabel(startDate)} – ${clockLabel(endDate)}`;
    }
    if (sameDay) return formatTimePoint(start, now);
    return `${formatTimePoint(start, now)} – ${formatTimePoint(end, now)}`;
  }

  if (end) return `due ${formatTimePoint(end, now)}`;
  if (start) return `from ${formatTimePoint(start, now)}`;
  return '';
}

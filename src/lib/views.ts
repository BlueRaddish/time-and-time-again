/**
 * Views are filters over one collection, not separate data sources.
 *
 * Every screen in the app is one of these predicates applied to the same array of Things.
 * Nothing here queries storage, and no screen owns data.
 */

import { isSameDay, sortValue, toDate } from '@/lib/time';
import { deriveThingType, type Thing } from '@/types/thing';

/** Today — anything whose start or end lands on the given day. */
export function isToday(thing: Thing, now: Date = new Date()): boolean {
  return [thing.start, thing.end].some((tp) => tp !== null && isSameDay(toDate(tp), now));
}

/** Calendar — Things with a start, i.e. Events and Anchors. */
export function hasStart(thing: Thing): boolean {
  return thing.start !== null;
}

/** Task list — an end and no start. */
export function isTask(thing: Thing): boolean {
  return deriveThingType(thing) === 'task';
}

/** Backlog / someday — neither field set. */
export function isBacklog(thing: Thing): boolean {
  return deriveThingType(thing) === 'note';
}

/** Earliest point on a Thing, for chronological ordering. */
function anchorTime(thing: Thing): number {
  return Math.min(sortValue(thing.start), sortValue(thing.end));
}

/**
 * Chronological, then newest-created as the tiebreak.
 *
 * Compared rather than subtracted: untimed Things both sort as `Infinity`, and
 * `Infinity - Infinity` is `NaN`, which silently corrupts a sort.
 */
export function byChronology(a: Thing, b: Thing): number {
  const left = anchorTime(a);
  const right = anchorTime(b);
  if (left !== right) return left < right ? -1 : 1;
  return b.createdAt.localeCompare(a.createdAt);
}

/** Due-date order, for the task list. */
export function byDueDate(a: Thing, b: Thing): number {
  const left = sortValue(a.end);
  const right = sortValue(b.end);
  if (left !== right) return left < right ? -1 : 1;
  return b.createdAt.localeCompare(a.createdAt);
}

/** Incomplete first, each group keeping its own order. */
export function byCompletion(a: Thing, b: Thing): number {
  const aDone = a.completedAt !== null ? 1 : 0;
  const bDone = b.completedAt !== null ? 1 : 0;
  return aDone - bDone;
}

/** Compose comparators left to right. */
export function sortBy(...comparators: ((a: Thing, b: Thing) => number)[]) {
  return (a: Thing, b: Thing): number => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

export type DayGroup = { key: string; day: Date; things: Thing[] };

/**
 * Group Things by the calendar day of their start. Used by the calendar view, which is an
 * agenda rather than a time grid — see the note on the calendar screen.
 */
export function groupByDay(things: Thing[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const thing of things) {
    if (!thing.start) continue;
    const day = toDate(thing.start);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.things.push(thing);
    } else {
      groups.set(key, { key, day, things: [thing] });
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.day.getTime() - b.day.getTime())
    .map((group) => ({ ...group, things: group.things.sort(byChronology) }));
}

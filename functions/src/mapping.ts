/**
 * Turning a Thing into what Google expects.
 *
 * Pure, so the fiddly parts are testable without touching a network: the exclusive end date on
 * all-day events, and what an Anchor — a start with no end — becomes when Google requires
 * every event to have one.
 */

import type { Thing, TimePoint } from './thing';

/** Google requires end > start for a timed event. An Anchor has no end, so it gets a block. */
export const ANCHOR_DURATION_MINUTES = 30;

export type CalendarDate = { date: string } | { dateTime: string; timeZone: string };

export type CalendarEvent = {
  summary: string;
  description?: string;
  start: CalendarDate;
  end: CalendarDate;
};

export type TaskResource = {
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  completed?: string;
};

/** `YYYY-MM-DD` from either storage form. Date-only points already store exactly this. */
export function dayOf(point: TimePoint): string {
  return point.at.slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfDayIso(day: string): string {
  return `${day}T00:00:00.000Z`;
}

function endOfDayIso(day: string): string {
  return `${day}T23:59:59.000Z`;
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/**
 * An event is all-day only when *both* ends are date-only. Mixed precision — "starts Friday,
 * ends 3pm Saturday" — is representable in the model, and rounding it to all-day would throw
 * away the one precise fact the user gave.
 */
function isAllDay(start: TimePoint, end: TimePoint): boolean {
  return start.precision === 'date' && end.precision === 'date';
}

export function toCalendarEvent(thing: Thing, timeZone: string): CalendarEvent {
  const { start, end } = thing;
  if (!start) {
    throw new Error(`Thing ${thing.id} has no start and does not belong on a calendar`);
  }

  const base = {
    summary: thing.title,
    ...(thing.notes ? { description: thing.notes } : {}),
  };

  // Anchor: a start and no end.
  if (!end) {
    if (start.precision === 'date') {
      const day = dayOf(start);
      // End is exclusive, so a single all-day event ends on the following day.
      return { ...base, start: { date: day }, end: { date: addDays(day, 1) } };
    }
    return {
      ...base,
      start: { dateTime: start.at, timeZone },
      end: { dateTime: addMinutes(start.at, ANCHOR_DURATION_MINUTES), timeZone },
    };
  }

  if (isAllDay(start, end)) {
    return {
      ...base,
      start: { date: dayOf(start) },
      // Google treats the end date of an all-day event as exclusive. Passing the same day for
      // a one-day event produces a zero-length event that renders on the wrong day or not at
      // all, which is the single most common bug in calendar integrations.
      end: { date: addDays(dayOf(end), 1) },
    };
  }

  return {
    ...base,
    start: {
      dateTime: start.precision === 'time' ? start.at : startOfDayIso(dayOf(start)),
      timeZone,
    },
    end: {
      dateTime: end.precision === 'time' ? end.at : endOfDayIso(dayOf(end)),
      timeZone,
    },
  };
}

/**
 * ## A fidelity limit worth knowing
 *
 * The Google Tasks API accepts an RFC-3339 `due` but **ignores the time of day** — a task due
 * at 3pm Friday shows in Google Tasks as due Friday. Nothing here can fix that; it is the
 * API's own behaviour. The time is still exact inside this app, and this is one more reason
 * Tasks and Calendar are kept separate rather than routing everything through events.
 */
export function toTask(thing: Thing): TaskResource {
  const { end } = thing;
  if (!end) {
    throw new Error(`Thing ${thing.id} has no end and is not a task`);
  }

  return {
    title: thing.title,
    ...(thing.notes ? { notes: thing.notes } : {}),
    due: startOfDayIso(dayOf(end)),
    status: thing.completedAt ? 'completed' : 'needsAction',
    ...(thing.completedAt ? { completed: thing.completedAt } : {}),
  };
}

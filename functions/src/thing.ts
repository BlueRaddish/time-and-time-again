/**
 * The domain model, mirrored.
 *
 * ## Why this is a copy
 *
 * `src/types/thing.ts` is the source of truth and this must not diverge from it. It is copied
 * rather than imported because Firebase deploys the `functions/` directory as a self-contained
 * package — an import reaching up into `../src` compiles locally and then fails at deploy,
 * which is the worst possible time to find out.
 *
 * `thing.test.ts` in this directory pins the same truth table as the app's own test. If the
 * two ever disagree, one of those suites goes red. That is the guard; keep it.
 *
 * `PARALLEL-SESSIONS.md` §4 calls `thing.ts` shared core: a change there is a change here.
 */

export type Precision = 'date' | 'time';

export type TimePoint = {
  /** ISO 8601. When precision is `date`, only the date portion is meaningful. */
  at: string;
  precision: Precision;
};

export type ThingType = 'note' | 'task' | 'event' | 'anchor';

export type Thing = {
  id: string;
  title: string;
  notes: string | null;
  start: TimePoint | null;
  end: TimePoint | null;
  completedAt: string | null;
  tags: string[];
  recurrenceRule: string | null;
  calendarSyncId: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 *   start   end   type
 *   —       —     note
 *   —       set   task
 *   set     set   event
 *   set     —     anchor
 */
export function deriveThingType(thing: Pick<Thing, 'start' | 'end'>): ThingType {
  if (thing.start && thing.end) return 'event';
  if (thing.start) return 'anchor';
  if (thing.end) return 'task';
  return 'note';
}

/** Where a Thing of each type belongs once it leaves the app. */
export type SyncTarget = 'calendar' | 'tasks' | 'none';

/**
 * The routing decision from `PLAN.md` §5.
 *
 * A Task goes to Google Tasks, not Google Calendar. Writing it to the calendar would block
 * time the user never committed — the semantics have to match or the sync is worse than none.
 */
export function syncTargetFor(type: ThingType): SyncTarget {
  switch (type) {
    case 'event':
    case 'anchor':
      return 'calendar';
    case 'task':
      return 'tasks';
    case 'note':
      return 'none';
  }
}

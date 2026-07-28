/**
 * The core domain model.
 *
 * Everything in this app is a `Thing`. There is one entity, not four. A Thing has
 * independent optional `start` and `end` points, and its *type* is never chosen by the user
 * and never stored — it is derived from which of those two fields are populated.
 *
 * This is the load-bearing architectural choice: because type is computed, you can never end
 * up with a Thing whose stored type disagrees with its own data.
 */

/** Whether a point in time is meaningful to the day, or to the minute. */
export type Precision = 'date' | 'time';

/**
 * A point in time plus how precisely it was meant.
 *
 * Precision is bundled with the timestamp rather than living in a sibling field, so that
 * "a time with no precision" and "a precision with no time" are both unrepresentable.
 */
export type TimePoint = {
  /** ISO 8601. When precision is `date`, only the date portion is meaningful. */
  at: string;
  precision: Precision;
};

/**
 * Derived, never stored. See {@link deriveThingType}.
 *
 * `anchor` — a start with no end ("call mom, starting whenever, no fixed end"; a habit you
 * just begin tracking). It falls out of the model rather than being designed in, and it is a
 * first-class type: the schema can represent it, so the UI must be able to show it.
 */
export type ThingType = 'note' | 'task' | 'event' | 'anchor';

export type Thing = {
  id: string;
  title: string;
  notes: string | null;
  start: TimePoint | null;
  end: TimePoint | null;
  /** ISO 8601 when checked off. Applies to any type, not just task-like Things. */
  completedAt: string | null;
  tags: string[];
  /** RFC 5545 RRULE. Reserved for Layer 3; nothing edits this yet. */
  recurrenceRule: string | null;
  /** External id from Google Calendar / Google Tasks. Reserved for phase 4. */
  calendarSyncId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The fields a caller supplies; everything else is filled in by the store. */
export type NewThing = {
  title: string;
  notes?: string | null;
  start?: TimePoint | null;
  end?: TimePoint | null;
  tags?: string[];
};

/** A partial update. Identity and audit fields are managed by the store, not the caller. */
export type ThingPatch = Partial<Omit<Thing, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * The whole type system of the app, in four branches.
 *
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

export function isComplete(thing: Thing): boolean {
  return thing.completedAt !== null;
}

/** Human-facing label for a derived type. */
export const THING_TYPE_LABEL: Record<ThingType, string> = {
  note: 'Note',
  task: 'Task',
  event: 'Event',
  anchor: 'Anchor',
};

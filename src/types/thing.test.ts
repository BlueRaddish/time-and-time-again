/**
 * The derived-type truth table is the load-bearing claim of the whole app: a Thing's type is
 * computed from its data, so it can never disagree with it. These tests pin that table down,
 * and pin down the two things that must *not* influence it — precision, and any other field.
 */

import {
  deriveThingType,
  isComplete,
  THING_TYPE_LABEL,
  type Thing,
  type ThingType,
  type TimePoint,
} from '@/types/thing';

const DATE: TimePoint = { at: '2026-07-27', precision: 'date' };
const TIME: TimePoint = { at: '2026-07-27T15:00:00.000Z', precision: 'time' };

function thing(overrides: Partial<Thing> = {}): Thing {
  return {
    id: 'id',
    title: 'title',
    notes: null,
    start: null,
    end: null,
    completedAt: null,
    tags: [],
    recurrenceRule: null,
    calendarSyncId: null,
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    ...overrides,
  };
}

describe('deriveThingType', () => {
  it.each<[string, TimePoint | null, TimePoint | null, ThingType]>([
    ['neither field set', null, null, 'note'],
    ['end only', null, DATE, 'task'],
    ['both set', DATE, DATE, 'event'],
    ['start only', DATE, null, 'anchor'],
  ])('%s → %s', (_label, start, end, expected) => {
    expect(deriveThingType({ start, end })).toBe(expected);
  });

  it('covers the table exhaustively — every combination has a type', () => {
    const points: (TimePoint | null)[] = [null, DATE];
    const derived = points.flatMap((start) =>
      points.map((end) => deriveThingType({ start, end }))
    );
    expect(new Set(derived)).toEqual(new Set(['note', 'task', 'event', 'anchor']));
  });

  it('ignores precision — only presence decides the type', () => {
    // "due sometime Friday" and "due 3pm Friday" are the same type at different resolutions.
    expect(deriveThingType({ start: null, end: DATE })).toBe('task');
    expect(deriveThingType({ start: null, end: TIME })).toBe('task');
    expect(deriveThingType({ start: DATE, end: TIME })).toBe('event');
    expect(deriveThingType({ start: TIME, end: DATE })).toBe('event');
  });

  it('ignores every field other than start and end', () => {
    const base = thing({ end: DATE });
    expect(deriveThingType(base)).toBe('task');
    expect(
      deriveThingType(
        thing({
          end: DATE,
          completedAt: '2026-07-27T12:00:00.000Z',
          tags: ['work'],
          recurrenceRule: 'FREQ=WEEKLY',
          calendarSyncId: 'gcal-1',
        })
      )
    ).toBe('task');
  });

  it('flips a Note to a Task when an end is added, with no other change', () => {
    const note = thing();
    expect(deriveThingType(note)).toBe('note');
    expect(deriveThingType({ ...note, end: DATE })).toBe('task');
  });

  it('flips a Task to an Event when a start is added', () => {
    const task = thing({ end: TIME });
    expect(deriveThingType(task)).toBe('task');
    expect(deriveThingType({ ...task, start: TIME })).toBe('event');
  });
});

describe('isComplete', () => {
  it('is true only when completedAt is set', () => {
    expect(isComplete(thing())).toBe(false);
    expect(isComplete(thing({ completedAt: '2026-07-27T12:00:00.000Z' }))).toBe(true);
  });

  it('applies to any type, not just task-like Things', () => {
    // Layer 0 promise: checking a Thing off works regardless of what it derives to.
    const completedAt = '2026-07-27T12:00:00.000Z';
    expect(isComplete(thing({ completedAt }))).toBe(true); // note
    expect(isComplete(thing({ start: DATE, end: DATE, completedAt }))).toBe(true); // event
    expect(isComplete(thing({ start: DATE, completedAt }))).toBe(true); // anchor
  });
});

describe('THING_TYPE_LABEL', () => {
  it('has a label for every derived type', () => {
    const types: ThingType[] = ['note', 'task', 'event', 'anchor'];
    for (const type of types) {
      expect(THING_TYPE_LABEL[type]).toBeTruthy();
    }
    expect(Object.keys(THING_TYPE_LABEL).sort()).toEqual([...types].sort());
  });
});

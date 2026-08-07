import { formatSyncRef, parseSyncRef, planSync } from './sync';
import type { Thing, TimePoint } from './thing';

function thing(overrides: Partial<Thing> = {}): Thing {
  return {
    id: 't1',
    title: 'dentist',
    notes: null,
    start: null,
    end: null,
    completedAt: null,
    tags: [],
    recurrenceRule: null,
    calendarSyncId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const date = (at: string): TimePoint => ({ at, precision: 'date' });

describe('sync refs', () => {
  it('round-trips', () => {
    expect(parseSyncRef(formatSyncRef({ target: 'calendar', id: 'abc' }))).toEqual({
      target: 'calendar',
      id: 'abc',
    });
  });

  it('keeps ids that contain colons intact', () => {
    // Google event ids are opaque; splitting on the last colon instead of the first would
    // silently corrupt any id containing one.
    expect(parseSyncRef('tasks:a:b:c')).toEqual({ target: 'tasks', id: 'a:b:c' });
  });

  it.each([null, undefined, '', 'abc', ':abc', 'calendar:', 'unknown:abc'])(
    'rejects %p',
    (value) => {
      expect(parseSyncRef(value as string | null)).toBeNull();
    }
  );
});

describe('planSync — first sync', () => {
  it('creates a calendar event for a new Event', () => {
    const after = thing({ start: date('2026-08-07'), end: date('2026-08-07') });
    expect(planSync(null, after)).toEqual({ kind: 'create', target: 'calendar' });
  });

  it('creates a calendar event for a new Anchor', () => {
    expect(planSync(null, thing({ start: date('2026-08-07') }))).toEqual({
      kind: 'create',
      target: 'calendar',
    });
  });

  it('creates a Google task for a new Task', () => {
    expect(planSync(null, thing({ end: date('2026-08-07') }))).toEqual({
      kind: 'create',
      target: 'tasks',
    });
  });

  it('does nothing for a Note', () => {
    expect(planSync(null, thing())).toEqual({ kind: 'none' });
  });
});

describe('planSync — the write-back loop', () => {
  it('does nothing when only the sync ref changed', () => {
    // Storing the new external id is itself a write, which fires the trigger again. Without
    // this branch that is an infinite loop billed per invocation.
    const before = thing({ start: date('2026-08-07'), end: date('2026-08-07') });
    const after = { ...before, calendarSyncId: 'calendar:evt1' };

    expect(planSync(before, after)).toEqual({ kind: 'none' });
  });

  it('does nothing when only updatedAt changed', () => {
    const before = thing({
      start: date('2026-08-07'),
      end: date('2026-08-07'),
      calendarSyncId: 'calendar:evt1',
    });
    const after = { ...before, updatedAt: '2026-08-09T00:00:00.000Z' };

    expect(planSync(before, after)).toEqual({ kind: 'none' });
  });

  it('does nothing when only tags changed, which Google never sees', () => {
    const before = thing({
      start: date('2026-08-07'),
      end: date('2026-08-07'),
      calendarSyncId: 'calendar:evt1',
    });
    expect(planSync(before, { ...before, tags: ['work'] })).toEqual({ kind: 'none' });
  });
});

describe('planSync — updates', () => {
  it('updates when the title changed', () => {
    const before = thing({
      start: date('2026-08-07'),
      end: date('2026-08-07'),
      calendarSyncId: 'calendar:evt1',
    });

    expect(planSync(before, { ...before, title: 'renamed' })).toEqual({
      kind: 'update',
      ref: { target: 'calendar', id: 'evt1' },
    });
  });

  it('updates when completion changed, so a checked-off task shows as done', () => {
    const before = thing({ end: date('2026-08-07'), calendarSyncId: 'tasks:task1' });

    expect(planSync(before, { ...before, completedAt: '2026-08-07T10:00:00.000Z' })).toEqual({
      kind: 'update',
      ref: { target: 'tasks', id: 'task1' },
    });
  });
});

describe('planSync — changing type', () => {
  it('moves a Task to the calendar when it gains a start', () => {
    // Give a Task a start time and it becomes an Event. Without the delete half of this, the
    // old Google task lingers forever alongside the new event.
    const before = thing({ end: date('2026-08-07'), calendarSyncId: 'tasks:task1' });
    const after = { ...before, start: date('2026-08-07') };

    expect(planSync(before, after)).toEqual({
      kind: 'move',
      from: { target: 'tasks', id: 'task1' },
      to: 'calendar',
    });
  });

  it('moves an Event to Tasks when it loses its start', () => {
    const before = thing({
      start: date('2026-08-07'),
      end: date('2026-08-07'),
      calendarSyncId: 'calendar:evt1',
    });
    const after = { ...before, start: null };

    expect(planSync(before, after)).toEqual({
      kind: 'move',
      from: { target: 'calendar', id: 'evt1' },
      to: 'tasks',
    });
  });

  it('deletes the remote copy when a Thing becomes a Note', () => {
    const before = thing({ end: date('2026-08-07'), calendarSyncId: 'tasks:task1' });
    const after = { ...before, end: null };

    expect(planSync(before, after)).toEqual({
      kind: 'delete',
      ref: { target: 'tasks', id: 'task1' },
    });
  });

  it('does nothing when a Note that never synced stays a Note', () => {
    const before = thing();
    expect(planSync(before, { ...before, title: 'renamed' })).toEqual({ kind: 'none' });
  });
});

describe('planSync — deletion', () => {
  it('deletes the remote copy', () => {
    const before = thing({ start: date('2026-08-07'), calendarSyncId: 'calendar:evt1' });
    expect(planSync(before, null)).toEqual({
      kind: 'delete',
      ref: { target: 'calendar', id: 'evt1' },
    });
  });

  it('does nothing when the deleted Thing never synced', () => {
    expect(planSync(thing(), null)).toEqual({ kind: 'none' });
  });
});

describe('planSync — recovery', () => {
  it('creates when a syncable Thing somehow has no ref', () => {
    // A create whose write-back failed leaves a Thing that should be synced and is not. The
    // next edit has to repair that rather than treat it as up to date.
    const before = thing({ start: date('2026-08-07'), end: date('2026-08-07') });
    expect(planSync(before, { ...before, title: 'renamed' })).toEqual({
      kind: 'create',
      target: 'calendar',
    });
  });
});

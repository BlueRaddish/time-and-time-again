import { addDays, toCalendarEvent, toTask } from './mapping';
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
const time = (at: string): TimePoint => ({ at, precision: 'time' });

describe('addDays', () => {
  it('rolls over month ends', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('rolls over year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('toCalendarEvent — all-day', () => {
  it('makes the end date exclusive for a single-day event', () => {
    // Google treats an all-day event's end as exclusive. Passing the same day produces a
    // zero-length event that renders on the wrong day or not at all.
    const event = toCalendarEvent(
      thing({ start: date('2026-08-07'), end: date('2026-08-07') }),
      'UTC'
    );

    expect(event.start).toEqual({ date: '2026-08-07' });
    expect(event.end).toEqual({ date: '2026-08-08' });
  });

  it('makes the end date exclusive for a multi-day event', () => {
    const event = toCalendarEvent(
      thing({ start: date('2026-08-07'), end: date('2026-08-09') }),
      'UTC'
    );

    expect(event.end).toEqual({ date: '2026-08-10' });
  });
});

describe('toCalendarEvent — timed', () => {
  it('passes both timestamps through with the zone', () => {
    const event = toCalendarEvent(
      thing({
        start: time('2026-08-07T15:00:00.000Z'),
        end: time('2026-08-07T16:00:00.000Z'),
      }),
      'Asia/Seoul'
    );

    expect(event.start).toEqual({
      dateTime: '2026-08-07T15:00:00.000Z',
      timeZone: 'Asia/Seoul',
    });
    expect(event.end).toEqual({ dateTime: '2026-08-07T16:00:00.000Z', timeZone: 'Asia/Seoul' });
  });

  it('does not round mixed precision down to an all-day event', () => {
    // "starts Friday, ends 3pm Saturday" is representable. Collapsing it to all-day would
    // throw away the one precise fact the user actually gave.
    const event = toCalendarEvent(
      thing({ start: date('2026-08-07'), end: time('2026-08-08T15:00:00.000Z') }),
      'UTC'
    );

    expect(event.start).toEqual({ dateTime: '2026-08-07T00:00:00.000Z', timeZone: 'UTC' });
    expect(event.end).toEqual({ dateTime: '2026-08-08T15:00:00.000Z', timeZone: 'UTC' });
  });
});

describe('toCalendarEvent — anchor', () => {
  it('gives a date-only anchor exactly one all-day slot', () => {
    const event = toCalendarEvent(thing({ start: date('2026-08-07') }), 'UTC');
    expect(event.start).toEqual({ date: '2026-08-07' });
    expect(event.end).toEqual({ date: '2026-08-08' });
  });

  it('resolves a timed anchor to the same all-day slot, inventing no duration', () => {
    // One time point is a day, not an interval -- the same rule a Task follows. Anything else
    // would have the app assert a length the user never gave.
    const event = toCalendarEvent(thing({ start: time('2026-08-07T15:00:00.000Z') }), 'UTC');

    expect(event.start).toEqual({ date: '2026-08-07' });
    expect(event.end).toEqual({ date: '2026-08-08' });
  });

  it('treats an anchor and a task with the same single time identically', () => {
    // Both carry exactly one point in time, so both resolve to the same day.
    const anchorDay = toCalendarEvent(thing({ start: time('2026-08-07T15:00:00.000Z') }), 'UTC');
    const taskDue = toTask(thing({ end: time('2026-08-07T15:00:00.000Z') })).due;

    expect(anchorDay.start).toEqual({ date: '2026-08-07' });
    expect(taskDue?.slice(0, 10)).toBe('2026-08-07');
  });

  it('refuses to put a Thing with no start on a calendar', () => {
    expect(() => toCalendarEvent(thing(), 'UTC')).toThrow(/no start/);
  });
});

describe('toCalendarEvent — content', () => {
  it('carries the title and omits an absent description', () => {
    const event = toCalendarEvent(thing({ start: date('2026-08-07') }), 'UTC');
    expect(event.summary).toBe('dentist');
    expect(event).not.toHaveProperty('description');
  });

  it('carries notes as the description', () => {
    const event = toCalendarEvent(
      thing({ start: date('2026-08-07'), notes: 'bring the form' }),
      'UTC'
    );
    expect(event.description).toBe('bring the form');
  });
});

describe('toTask', () => {
  it('uses the end date as the due date', () => {
    const task = toTask(thing({ title: 'essay', end: date('2026-08-07') }));
    expect(task.title).toBe('essay');
    expect(task.due).toBe('2026-08-07T00:00:00.000Z');
  });

  it('drops the time of day, because the Tasks API ignores it anyway', () => {
    const task = toTask(thing({ end: time('2026-08-07T15:00:00.000Z') }));
    expect(task.due).toBe('2026-08-07T00:00:00.000Z');
  });

  it('marks a completed Thing complete', () => {
    const task = toTask(
      thing({ end: date('2026-08-07'), completedAt: '2026-08-06T09:00:00.000Z' })
    );
    expect(task.status).toBe('completed');
    expect(task.completed).toBe('2026-08-06T09:00:00.000Z');
  });

  it('marks an open Thing as needing action', () => {
    const task = toTask(thing({ end: date('2026-08-07') }));
    expect(task.status).toBe('needsAction');
    expect(task).not.toHaveProperty('completed');
  });

  it('refuses a Thing with no end', () => {
    expect(() => toTask(thing())).toThrow(/no end/);
  });
});

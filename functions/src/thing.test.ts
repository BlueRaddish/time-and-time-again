import { deriveThingType, syncTargetFor, type TimePoint } from './thing';

const day: TimePoint = { at: '2026-08-07', precision: 'date' };
const clock: TimePoint = { at: '2026-08-07T15:00:00.000Z', precision: 'time' };

/**
 * The same truth table as src/types/thing.test.ts. These two files are copies of one another
 * by necessity (see thing.ts) — if they ever disagree, one of these suites goes red, which is
 * the entire point of duplicating the test alongside the code.
 */
describe('deriveThingType', () => {
  it.each([
    ['note', null, null],
    ['task', null, day],
    ['event', day, day],
    ['anchor', day, null],
  ])('is %s', (expected, start, end) => {
    expect(deriveThingType({ start, end })).toBe(expected);
  });

  it('does not care about precision', () => {
    expect(deriveThingType({ start: clock, end: null })).toBe('anchor');
    expect(deriveThingType({ start: null, end: clock })).toBe('task');
  });
});

describe('syncTargetFor', () => {
  it('sends events and anchors to the calendar', () => {
    expect(syncTargetFor('event')).toBe('calendar');
    expect(syncTargetFor('anchor')).toBe('calendar');
  });

  it('sends tasks to Google Tasks, not the calendar', () => {
    // A task occupies no time. Writing it as an event blocks time the user never committed.
    expect(syncTargetFor('task')).toBe('tasks');
  });

  it('never syncs notes', () => {
    expect(syncTargetFor('note')).toBe('none');
  });
});

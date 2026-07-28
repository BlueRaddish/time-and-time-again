/**
 * Quick-capture parsing.
 *
 * Two things make these tests worth reading carefully:
 *
 * **`now` is fixed.** Every case runs against Monday 27 July 2026, 09:00 local, so "friday"
 * and "tomorrow" have stable answers and a test cannot start failing at midnight.
 *
 * **Assertions are on local calendar parts, never on the raw `at` string.** A timed TimePoint
 * stores UTC, so asserting `at === '2026-07-31T15:00:00.000Z'` would only pass in one
 * timezone. Going back through `toDate` and reading local fields is the same round trip the
 * UI makes, and it holds in every zone the four streams and CI might run in.
 */

import { parseCapture } from '@/lib/nl-parse';
import { toDate } from '@/lib/time';
import { deriveThingType, type TimePoint } from '@/types/thing';

/** Monday 27 July 2026, 09:00 local. */
const NOW = new Date(2026, 6, 27, 9, 0, 0, 0);

const pad = (n: number) => String(n).padStart(2, '0');

/** A TimePoint as local calendar parts — stable in any timezone, readable when it fails. */
function parts(tp: TimePoint | null) {
  if (!tp) return null;
  const d = toDate(tp);
  return {
    precision: tp.precision,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: tp.precision === 'time' ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : null,
  };
}

const parse = (input: string) => {
  const result = parseCapture(input, NOW);
  return {
    title: result.title,
    start: parts(result.start),
    end: parts(result.end),
    type: deriveThingType(result),
  };
};

const dateOn = (date: string) => ({ precision: 'date', date, time: null });
const timeAt = (date: string, time: string) => ({ precision: 'time', date, time });

// ---------------------------------------------------------------------------

describe('the four types, end to end', () => {
  // The table from the module doc. If this block passes, capture can reach every type.
  it('"buy milk" → Note', () => {
    expect(parse('buy milk')).toEqual({
      title: 'buy milk',
      start: null,
      end: null,
      type: 'note',
    });
  });

  it('"essay due friday" → Task', () => {
    expect(parse('essay due friday')).toEqual({
      title: 'essay',
      start: null,
      end: dateOn('2026-07-31'),
      type: 'task',
    });
  });

  it('"dentist fri 3pm-4pm" → Event', () => {
    expect(parse('dentist fri 3pm-4pm')).toEqual({
      title: 'dentist',
      start: timeAt('2026-07-31', '15:00'),
      end: timeAt('2026-07-31', '16:00'),
      type: 'event',
    });
  });

  it('"dentist friday" → Anchor', () => {
    expect(parse('dentist friday')).toEqual({
      title: 'dentist',
      start: dateOn('2026-07-31'),
      end: null,
      type: 'anchor',
    });
  });
});

describe('start vs end — the rule that decides the type', () => {
  it('sends a bare temporal expression to start', () => {
    expect(parse('dentist friday').start).toEqual(dateOn('2026-07-31'));
    expect(parse('dentist friday').end).toBeNull();
  });

  it.each(['due', 'by', 'before', 'until', 'till'])(
    'redirects to end after "%s"',
    (keyword) => {
      const result = parse(`essay ${keyword} friday`);
      expect(result.start).toBeNull();
      expect(result.end).toEqual(dateOn('2026-07-31'));
      expect(result.type).toBe('task');
    }
  );

  it('accepts a connector between the keyword and the expression', () => {
    expect(parse('essay due on friday').end).toEqual(dateOn('2026-07-31'));
    expect(parse('essay due by friday').end).toEqual(dateOn('2026-07-31'));
  });

  it('only honours the keyword when it sits against the expression', () => {
    // "by" is in the title here, with "card" between it and the day, so it must not redirect.
    const result = parse('pay by card tomorrow');
    expect(result).toEqual({
      title: 'pay by card',
      start: dateOn('2026-07-28'),
      end: null,
      type: 'anchor',
    });
  });

  it('lets an explicit range straddle both fields, keyword or not', () => {
    const result = parse('shift due fri 9am-5pm');
    expect(result).toEqual({
      title: 'shift',
      start: timeAt('2026-07-31', '09:00'),
      end: timeAt('2026-07-31', '17:00'),
      type: 'event',
    });
  });
});

describe('days', () => {
  it('resolves today and tonight to the current day', () => {
    expect(parse('gym today').start).toEqual(dateOn('2026-07-27'));
    expect(parse('gym tonight').start).toEqual(dateOn('2026-07-27'));
  });

  it.each(['tomorrow', 'tmr', 'tmrw'])('resolves "%s" to the next day', (word) => {
    expect(parse(`gym ${word}`).start).toEqual(dateOn('2026-07-28'));
  });

  it('resolves a weekday forward, never backward', () => {
    // now is Monday. Sunday is six days ahead, not yesterday.
    expect(parse('gym sunday').start).toEqual(dateOn('2026-08-02'));
    expect(parse('gym tuesday').start).toEqual(dateOn('2026-07-28'));
  });

  it('resolves the current weekday to today, not a week out', () => {
    expect(parse('gym monday').start).toEqual(dateOn('2026-07-27'));
  });

  it('adds a week for "next"', () => {
    expect(parse('gym next friday').start).toEqual(dateOn('2026-08-07'));
    expect(parse('gym next monday').start).toEqual(dateOn('2026-08-03'));
  });

  it.each([
    ['fri', '2026-07-31'],
    ['friday', '2026-07-31'],
    ['weds', '2026-07-29'],
    ['wednesday', '2026-07-29'],
    ['thurs', '2026-07-30'],
    ['tues', '2026-07-28'],
    ['sat', '2026-08-01'],
  ])('accepts the abbreviation "%s"', (word, expected) => {
    expect(parse(`gym ${word}`).start).toEqual(dateOn(expected));
  });

  it('gives a day with no time date precision', () => {
    // "due sometime Friday" must not silently become midnight Friday.
    expect(parse('essay due friday').end?.precision).toBe('date');
  });
});

describe('times', () => {
  it('reads a 12-hour time with a meridiem', () => {
    expect(parse('lunch 12pm').start).toEqual(timeAt('2026-07-27', '12:00'));
    expect(parse('lunch 12am tomorrow').start).toEqual(timeAt('2026-07-28', '00:00'));
    expect(parse('standup 9:30am tomorrow').start).toEqual(timeAt('2026-07-28', '09:30'));
  });

  it('reads a 24-hour clock time', () => {
    expect(parse('meeting 15:00 tomorrow').start).toEqual(timeAt('2026-07-28', '15:00'));
  });

  it('rolls a bare past time forward to the next day', () => {
    // now is 09:00. "8am" means tomorrow morning, not an hour ago.
    expect(parse('standup 8am').start).toEqual(timeAt('2026-07-28', '08:00'));
  });

  it('does not roll forward when a day was given explicitly', () => {
    expect(parse('standup 8am today').start).toEqual(timeAt('2026-07-27', '08:00'));
  });
});

describe('ranges', () => {
  it('carries a meridiem backwards from the end of the range', () => {
    expect(parse('call 3-4pm tomorrow')).toMatchObject({
      start: timeAt('2026-07-28', '15:00'),
      end: timeAt('2026-07-28', '16:00'),
    });
  });

  it('does not collapse a range that crosses noon into a negative duration', () => {
    expect(parse('call 11am-1pm tomorrow')).toMatchObject({
      start: timeAt('2026-07-28', '11:00'),
      end: timeAt('2026-07-28', '13:00'),
    });
    expect(parse('call 11-1pm tomorrow')).toMatchObject({
      start: timeAt('2026-07-28', '11:00'),
      end: timeAt('2026-07-28', '13:00'),
    });
  });

  it('wraps past midnight instead of ending before it starts', () => {
    expect(parse('party 11pm-1am today')).toMatchObject({
      start: timeAt('2026-07-27', '23:00'),
      end: timeAt('2026-07-28', '01:00'),
    });
  });

  it('accepts "to" and en/em dashes as separators', () => {
    const expected = {
      start: timeAt('2026-07-28', '15:00'),
      end: timeAt('2026-07-28', '16:00'),
    };
    expect(parse('call 3pm to 4pm tomorrow')).toMatchObject(expected);
    expect(parse('call 3pm–4pm tomorrow')).toMatchObject(expected);
    expect(parse('call 3pm—4pm tomorrow')).toMatchObject(expected);
  });

  it('ignores a bare number range with no clock signal', () => {
    // The guard that stops "3-4" in prose from becoming an appointment.
    expect(parse('buy 3-4 apples')).toEqual({
      title: 'buy 3-4 apples',
      start: null,
      end: null,
      type: 'note',
    });
  });

  it('accepts a range signalled by a colon rather than a meridiem', () => {
    expect(parse('call 14:00-15:30 tomorrow')).toMatchObject({
      start: timeAt('2026-07-28', '14:00'),
      end: timeAt('2026-07-28', '15:30'),
    });
  });
});

describe('title cleanup', () => {
  it('takes the connector with the expression it introduces', () => {
    expect(parse('party on friday').title).toBe('party');
    expect(parse('essay due by friday').title).toBe('essay');
    expect(parse('call mom at 3pm tomorrow').title).toBe('call mom');
  });

  it('only strips a connector that sits against the expression', () => {
    // The reason the strip is not global: this must keep its "on".
    expect(parse('turn on the lights tomorrow').title).toBe('turn on the lights');
  });

  it('leaves a title with no temporal expression untouched', () => {
    expect(parse('  buy milk  ').title).toBe('buy milk');
  });

  it('does not leave dangling punctuation or double spaces', () => {
    expect(parse('dentist - friday').title).toBe('dentist');
    expect(parse('dentist, friday').title).toBe('dentist');
  });

  it('handles a temporal expression at the front', () => {
    expect(parse('friday dentist').title).toBe('dentist');
  });
});

describe('empty input', () => {
  it.each(['', '   '])('returns an empty result for %p', (input) => {
    expect(parseCapture(input, NOW)).toEqual({ title: '', start: null, end: null });
  });
});

describe('known limitations', () => {
  // Pinned deliberately. These are the edges of a heuristic parser, not bugs with fixes
  // queued — they are here so a later change that alters them is a visible decision rather
  // than a silent regression.

  it('reads only the first temporal expression in the string', () => {
    // "friday" is part of the title, but it matches first, so "tomorrow" is never reached.
    const result = parse('book by friday author, remind me tomorrow');
    expect(result.end).toEqual(dateOn('2026-07-31'));
    expect(result.title).toContain('tomorrow');
  });

  it('treats a day word inside the title as a date', () => {
    expect(parse('watch friday the 13th').start).toEqual(dateOn('2026-07-31'));
  });
});

describe('purity', () => {
  it('does not mutate the now it is given', () => {
    const now = new Date(NOW);
    parseCapture('dentist next friday 3pm-4pm', now);
    expect(now.getTime()).toBe(NOW.getTime());
  });
});

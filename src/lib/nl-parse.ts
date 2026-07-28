/**
 * Natural-language parsing for the quick-capture bar.
 *
 * This is the single biggest lever for making the minimal case feel effortless rather than
 * like a form: "dentist fri 3pm-4pm" should become an Event without the user ever opening a
 * picker or choosing a type.
 *
 * ## The one rule that decides derived type
 *
 * A bare temporal expression sets **start**. The keywords `due`, `by`, `before`, `until`,
 * `till` — when they sit immediately before the expression — send it to **end** instead.
 *
 *   "dentist friday"       → start=Fri            → Anchor
 *   "essay due friday"     → end=Fri              → Task
 *   "dentist fri 3pm-4pm"  → start+end            → Event
 *   "buy milk"             → neither              → Note
 *
 * That rule is worth knowing because it is the only thing standing between a captured phrase
 * and which of the four types it lands on.
 *
 * Everything here is pure and dependency-free, which makes it the natural first thing to
 * unit-test once a test runner exists.
 */

import { addDays, atTime, dateOnly, startOfDay } from '@/lib/time';
import type { TimePoint } from '@/types/thing';

export type ParsedCapture = {
  title: string;
  start: TimePoint | null;
  end: TimePoint | null;
};

type Span = { from: number; to: number };

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const DAY_WORD =
  /\b(next\s+)?(today|tonight|tomorrow|tmr|tmrw|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i;

/** A range needs a meridiem or a colon somewhere, or "3-4" in prose would match. */
const TIME_RANGE =
  /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

/** Either an explicit meridiem (`3pm`, `3:30 pm`) or a 24-hour clock time (`15:00`). */
const SINGLE_TIME = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i;

/** Keywords that redirect a temporal expression from `start` to `end`. */
const END_KEYWORD = /\b(due|by|before|until|till)\s*(?:on|at)?\s*$/i;

/**
 * Connector words that belong to a temporal span rather than to the title.
 *
 * Only stripped where they sit immediately before a cut span — a global strip would turn
 * "turn on the lights" into "turn the lights".
 */
const TRAILING_CONNECTOR = /\b(?:due\s+)?(?:on|at|from|by|before|until|till|due)\s*$/i;

export function parseCapture(input: string, now: Date = new Date()): ParsedCapture {
  const text = input.trim();
  if (!text) return { title: '', start: null, end: null };

  const spans: Span[] = [];

  // --- day ---
  let day: Date | null = null;
  const dayMatch = DAY_WORD.exec(text);
  if (dayMatch) {
    day = resolveDay(dayMatch[2].toLowerCase(), Boolean(dayMatch[1]), now);
    spans.push({ from: dayMatch.index, to: dayMatch.index + dayMatch[0].length });
  }

  // --- time (range wins over single) ---
  let startClock: Clock | null = null;
  let endClock: Clock | null = null;

  const rangeMatch = TIME_RANGE.exec(text);
  if (rangeMatch && (rangeMatch[3] || rangeMatch[6] || rangeMatch[2] || rangeMatch[5])) {
    const [, h1, m1, ap1, h2, m2, ap2] = rangeMatch;
    const pair = resolveRange(
      { hour: Number(h1), minute: Number(m1 ?? 0), meridiem: ap1?.toLowerCase() },
      { hour: Number(h2), minute: Number(m2 ?? 0), meridiem: ap2?.toLowerCase() }
    );
    startClock = pair.start;
    endClock = pair.end;
    spans.push({ from: rangeMatch.index, to: rangeMatch.index + rangeMatch[0].length });
  } else {
    const timeMatch = SINGLE_TIME.exec(text);
    if (timeMatch) {
      startClock = timeMatch[3]
        ? normalize({
            hour: Number(timeMatch[1]),
            minute: Number(timeMatch[2] ?? 0),
            meridiem: timeMatch[3].toLowerCase(),
          })
        : { hour: Number(timeMatch[4]), minute: Number(timeMatch[5]) };
      spans.push({ from: timeMatch.index, to: timeMatch.index + timeMatch[0].length });
    }
  }

  if (!day && !startClock) {
    return { title: text, start: null, end: null };
  }

  // --- build the points ---
  const base = day ?? startOfDay(now);
  let first: TimePoint;
  let second: TimePoint | null = null;

  if (startClock && endClock) {
    const from = applyClock(base, startClock);
    let to = applyClock(base, endClock);
    // "11pm-1am" wraps past midnight.
    if (to <= from) to = addDays(to, 1);
    first = atTime(from);
    second = atTime(to);
  } else if (startClock) {
    let when = applyClock(base, startClock);
    // A bare time with no day, already past, means the next one — not this morning.
    if (!day && when <= now) when = addDays(when, 1);
    first = atTime(when);
  } else {
    first = dateOnly(base);
  }

  // --- which field? ---
  const earliest = Math.min(...spans.map((s) => s.from));
  const toEnd = END_KEYWORD.test(text.slice(0, earliest));

  const title = cleanTitle(text, spans);

  if (second) {
    // An explicit range always straddles both fields, keyword or not.
    return { title, start: first, end: second };
  }
  return toEnd ? { title, start: null, end: first } : { title, start: first, end: null };
}

// ---------------------------------------------------------------------------

type Clock = { hour: number; minute: number };
type LooseClock = { hour: number; minute: number; meridiem?: string };

function normalize(c: LooseClock): Clock {
  let hour = c.hour;
  if (c.meridiem === 'pm' && hour < 12) hour += 12;
  if (c.meridiem === 'am' && hour === 12) hour = 0;
  return { hour, minute: c.minute };
}

/**
 * Fill in a missing meridiem from the other end of the range: "3-4pm" is an afternoon, and
 * "11am-1pm" must not collapse into a negative duration.
 */
function resolveRange(a: LooseClock, b: LooseClock): { start: Clock; end: Clock } {
  if (a.meridiem && !b.meridiem) {
    const start = normalize(a);
    let end = normalize({ ...b, meridiem: a.meridiem });
    if (end.hour < start.hour) end = normalize({ ...b, meridiem: a.meridiem === 'am' ? 'pm' : 'am' });
    return { start, end };
  }
  if (!a.meridiem && b.meridiem) {
    const end = normalize(b);
    let start = normalize({ ...a, meridiem: b.meridiem });
    if (start.hour > end.hour) start = normalize({ ...a, meridiem: b.meridiem === 'pm' ? 'am' : 'pm' });
    return { start, end };
  }
  return { start: normalize(a), end: normalize(b) };
}

function applyClock(day: Date, clock: Clock): Date {
  const d = startOfDay(day);
  d.setHours(clock.hour, clock.minute, 0, 0);
  return d;
}

function resolveDay(token: string, hasNext: boolean, now: Date): Date {
  if (token === 'today' || token === 'tonight') return startOfDay(now);
  if (token === 'tomorrow' || token === 'tmr' || token === 'tmrw') {
    return startOfDay(addDays(now, 1));
  }

  const target = WEEKDAYS[token];
  if (target === undefined) return startOfDay(now);

  const today = startOfDay(now);
  const delta = (target - today.getDay() + 7) % 7;
  return addDays(today, hasNext ? delta + 7 : delta);
}

/**
 * Cut the matched spans out and tidy up what's left.
 *
 * Each span first grows backwards over any connector word introducing it, so "essay due
 * friday" loses "due friday" rather than leaving a dangling "essay due".
 */
function cleanTitle(text: string, spans: Span[]): string {
  const widened = spans.map((span) => {
    const before = text.slice(0, span.from);
    const connector = TRAILING_CONNECTOR.exec(before);
    return connector ? { from: connector.index, to: span.to } : span;
  });

  const ordered = widened.sort((a, b) => b.from - a.from);
  let out = text;
  for (const span of ordered) {
    out = out.slice(0, span.from) + ' ' + out.slice(span.to);
  }

  return out
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—,]+|[\s\-–—,]+$/g, '')
    .trim();
}

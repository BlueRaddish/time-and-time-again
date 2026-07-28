# Time and Time Again

A cross-platform to-do app for iOS, Android, and web, built on the idea that there is only
one kind of entry.

Everything you log is a **Thing**. A Thing has an optional start and an optional end, and its
type is never chosen — it's derived from which of those you filled in:

| start | end | type       | example                |
| ----- | --- | ---------- | ---------------------- |
| —     | —   | **Note**   | "buy milk"             |
| —     | set | **Task**   | "essay due friday"     |
| set   | set | **Event**  | "dentist fri 3pm–4pm"  |
| set   | —   | **Anchor** | "start project monday" |

Each of start and end independently carries its own precision — date-only or a specific time
— so "due sometime Friday" and "due 3pm Friday" are the same type at different resolutions.

A light user types a title, presses enter, and never learns any of this exists.

## Stack

Expo (React Native) + TypeScript, targeting all three platforms from one codebase. Firebase
for auth, data, and hosting from phase 2 onward. Full plan, timeline, and decision log in
[`docs/PLAN.md`](docs/PLAN.md).

## Running it

```bash
npm install
npm run web        # browser
npm run android    # device or emulator
npm run ios        # requires macOS, or use EAS
```

Typecheck with `npx tsc --noEmit`.

## Layout

```
src/
  types/thing.ts        the Thing model and deriveThingType — the core of the app
  lib/
    nl-parse.ts         natural-language capture ("dentist fri 3pm-4pm")
    time.ts             TimePoint construction and conversion
    views.ts            one predicate per view; every screen is a filter
    format.ts           display formatting, precision-aware
  data/                 persistence behind a Firestore-shaped interface
  store/                the single source of Things
  components/           quick capture, rows, lists, tab bars
  app/                  five routes, each a thin filter
```

## Status

Phase 1 — local CRUD, capture, and the five views. No accounts, no sync, and no calendar
integration yet; see `docs/PLAN.md` for the phase breakdown.

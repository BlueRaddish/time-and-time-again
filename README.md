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

Expo (React Native) + TypeScript, from one codebase. Firebase for auth, data, and hosting
from phase 2 onward. Full plan, timeline, and decision log in [`docs/PLAN.md`](docs/PLAN.md).

**Shipping to Android and web.** iOS builds from the same source and runs fine locally, but
is not a release target — the Apple Developer Program isn't worth $99/yr for one project. It
can be picked up later without touching the code.

## Running it

```bash
npm install
npm run web        # browser
npm run android    # device or emulator
npm run ios        # requires macOS, or use EAS
```

```bash
npm test           # Jest, once — covers functions/ too
npm run test:watch # while working
npm run typecheck  # tsc --noEmit

cd functions && npm run typecheck   # the functions have their own tsconfig
```

Both `npm test` and `npm run typecheck` must be clean before anything merges — see
[`docs/PARALLEL-SESSIONS.md`](docs/PARALLEL-SESSIONS.md) §8.

## Layout

```
src/
  types/thing.ts        the Thing model and deriveThingType — the core of the app
  types/thing.test.ts   the derived-type truth table, pinned
  lib/
    nl-parse.ts         natural-language capture ("dentist fri 3pm-4pm")
    time.ts             TimePoint construction and conversion
    views.ts            one predicate per view; every screen is a filter
    format.ts           display formatting, precision-aware
    firebase.ts         the one place Firebase starts; null when unconfigured
    firebase-config.ts  environment config, and the local-only switch
    auth-providers.ts   sign-in methods as data, not as buttons
  data/
    firestore-repository.ts   the remote store, scoped by uid
    async-storage-repository.ts  the local mirror, and phase 1's whole store
    outbox.ts             queued writes and the rules for collapsing them
    offline-repository.ts mirror for reads, durable outbox for writes
  store/                Things, auth, and the repository selector
  components/           quick capture, rows, lists, tab bars, sign-in, settings
  app/                  six routes, each a thin filter

functions/src/          Cloud Functions — one-way sync to Google
  thing.ts              mirrored domain model; must not diverge from src/types/thing.ts
  mapping.ts            Thing → Calendar event / Google task
  sync.ts               what to do on a change, as pure data
  index.ts              the trigger and the connect/disconnect callables

firestore.rules         uid-scoped; denies clients the stored refresh token outright
```

## Status

Phases 1–5 are written. The Firebase project (`timeandtimeagain`) exists, its security rules
are deployed and enforcing, and `.env.local` is wired — so the app now starts in Firebase mode.

What has actually been exercised end to end is phase 1 plus the build: 167 tests, a clean
production web export, and hosting verified serving `/privacy` and `/delete-account`. What has
**not** been exercised is anyone signing in — the sign-in providers are still switched off in
the Firebase console, which is browser-only work. See `docs/PHASE-0.md`.

**The app still runs with no configuration at all.** Remove the environment variables and it
behaves exactly as it did in phase 1: no sign-in step, Things stored on the device. That switch
is `isFirebaseConfigured()` in `src/lib/firebase-config.ts`, and it is deliberately kept alive.

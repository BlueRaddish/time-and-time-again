# Time and Time Again — Design & Delivery Plan

Cross-platform to-do / time app for iOS, Android, and web.

> Source: consolidated from the planning conversation of 2026-07-27.
> Open decisions are marked **OPEN** and should be resolved before schema work.

---

## 1. Core concept: one entity, not three

Everything in the app is a **Thing**. It has independent optional `start` and `end`
fields, each with its own precision (date-only or specific-time). The "type" is never
chosen by the user and never stored — it is **derived** from which fields are populated.

| start_at | end_at | Derived type |
| -------- | ------ | ------------ |
| —        | —      | **Note**     |
| —        | set    | **Task**     |
| set      | set    | **Event**    |
| set      | —      | **Anchor**   |

**Anchor** falls out of the model naturally (e.g. "call mom, starting whenever, no fixed
end"; a habit you start tracking).

**DECIDED (2026-07-27): Anchor is a real fourth type.** It gets first-class derived-type
status and its own affordances. Rationale: the schema can represent `start_at` set with
`end_at` null, so the app must be able to display it — collapsing the type would leave a
representable state the UI can't honestly show.

### Precision is a separate, per-field axis

`start` and `end` are each independently date-only or specific-time. "Due sometime on the
5th" and "due at 3:00pm on the 5th" are the same *type* (Task) at different precision.
This drives the calendar sync decision (all-day vs. timed event).

### Data model

```
Thing {
  id
  title
  notes             (optional)
  start_at          (nullable datetime)
  start_precision   (date | time — only meaningful if start_at is set)
  end_at            (nullable datetime)
  end_precision     (date | time — only meaningful if end_at is set)
  completed_at      (nullable — for task-like Things)
  tags[]
  recurrence_rule   (nullable)
  calendar_sync_id  (nullable external id)
  created_at / updated_at
}
```

Type is computed at query time. This keeps the schema honest — you can never get a Thing
whose stored type disagrees with its actual data.

---

## 2. Minimalism through progressive disclosure

The **quick-capture bar is the whole app** for a light user: type a title, hit enter,
done. It becomes a Note by default. No modal, no "select type" step.

- **Tap to expand** reveals two optional chips: `start` and `end`. Tapping one opens a
  compact date/time picker with a date-only vs. specific-time toggle.
- Nothing is mandatory except the title. A user who never touches the chips never sees a
  task/event distinction — they just see a flat list of Things.
- **Natural-language parsing** in the input field ("dentist fri 3pm–4pm") is worth
  building early. It is the single biggest lever for making the minimal case feel
  effortless rather than like a form.

### Views are just filters over one table

| View              | Filter                                      |
| ----------------- | ------------------------------------------- |
| Today             | `start_at` or `end_at` falls today          |
| Calendar          | `start_at` set (Events + Anchors), on a timeline |
| Task list         | `end_at` set and no `start_at`, sorted by due date |
| Backlog / someday | neither field set                           |
| Everything        | flat, sortable by any field                 |

### Settings: layered, not binary

Not a "simple mode / advanced mode" toggle — layers a user opts into one at a time.

- **Layer 0** (default, invisible) — smart defaults. A new Thing shows nothing beyond
  title; the app infers behavior (e.g. checking a Thing off marks it completed regardless
  of type).
- **Layer 1** (per-Thing) — the expand-to-add-fields interaction above. Available to
  everyone, used only when needed for that particular Thing.
- **Layer 2** (global preferences) — default view on open, week start day, default
  precision for new items, which calendars sync, notification defaults.
- **Layer 3** (power-user) — custom recurrence rules, tag-based smart filters / saved
  views, subtasks or linked Things, keyboard shortcuts, per-tag color and behavior
  overrides.

> **The test of whether the minimalism is real:** nothing in Layer 0–1 may require knowing
> that Layer 2–3 exists in order to use the app correctly. A light user never needs to
> know Layer 3 is there; a heavy user can go find it.

---

## 3. Tech stack

**Framework:** Expo (React Native) + TypeScript — iOS, Android, and web from one codebase.

Chosen over Flutter because EAS Build/Submit is the smoothest path to getting builds into
the App Store and Play Store *without owning a Mac*, which matters given the goal is
deployment practice, not just coding practice. Flutter is equally valid technically; Expo
wins specifically on the store-submission tooling.

**Backend:** Firebase — avoids standing up and maintaining a server for a practice project.

- Firebase Auth — email/password + Sign in with Google
- Firestore — Thing data
- Cloud Functions — only needed to securely store Google OAuth refresh tokens server-side
  for calendar sync
- Firebase Hosting — web build

---

## 4. Account management

- Firebase Auth handles password hashing, sessions, and token refresh. Do not roll your own.
- Offer email/password and Google Sign-In. **If you offer Google Sign-In, Apple requires
  Sign in with Apple as an equivalent option.** Plan for this from day one — its absence
  is an App Store rejection reason.
- **Apple requires an in-app account deletion flow**, not "contact support to delete."
  Build this early so it isn't a last-minute scramble before submission.
- Firestore security rules scoped by `uid` so users can only read/write their own Things.

### Correction (2026-08-07): iOS is dropped, so two of the three Apple rules lapse

The App Store is not a target for this project — $99/yr is not worth it for one practice app.
Sign in with Apple is therefore **not** required (that rule binds App Store submissions), and
the Apple review buffer leaves phase 7.

**Account deletion stays.** Google Play requires it independently of Apple: any app offering
account creation must provide in-app deletion plus a publicly reachable deletion-request URL.
Dropping iOS does not buy that back. Phase 2 should still keep the provider list as data so
that adding Sign in with Apple later is an entry, not a rewrite. See
[`PHASE-0.md`](PHASE-0.md) Track B.

---

## 5. Google Calendar integration

This is the part that affects the timeline most.

**Scope choice:** use `calendar.events` (create/update events), *not* full Calendar access.
`calendar.events` is a **sensitive** scope, not a **restricted** one — so it needs standard
sensitive-scope verification, with no third-party security assessment / CASA audit.

Restricted-scope verification can take several weeks because it requires an annual
third-party security assessment. Requesting sensitive or restricted scopes without
completing verification caps the app at 100 users and shows an "unverified app" warning to
testers.

- Sensitive-scope verification typically takes up to ~10 days after a complete submission,
  but real-world reports run much longer with back-and-forth (one recent report: 5+ weeks
  on `calendar.events`). **Submit early.**
- Under 100 test users, verification isn't required at all — fine during development, but
  it must be done before public store release.

**Sync direction:** start **one-way** (Thing → calendar event, created by a Cloud Function
using the stored refresh token). Two-way sync (calendar edits flowing back into the app) is
meaningfully more complex — a v2 stretch goal, not MVP.

### Sync mapping

| Thing         | Behavior                                                              |
| ------------- | --------------------------------------------------------------------- |
| Event, Anchor | Real Google Calendar event — timed if `start_precision` is `time`, all-day if `date` |
| Task (end-only) | See OPEN #2                                                         |
| Note          | Never syncs — nothing to sync                                         |

**DECIDED (2026-07-27): pure Tasks sync via the Google Tasks API.** Correct semantics —
a task syncs as a task, not as an event blocking time it doesn't occupy.

Consequence for phase 0: this needs a **second OAuth scope** (`tasks`) alongside
`calendar.events`. Both are sensitive scopes. **Submit both together** on the initial
consent-screen application — adding a scope later restarts verification.

---

## 6. Phase order

Revised 2026-08-07 for the iOS drop and the Play testing requirement. Android and web only.

**No duration estimates.** Development happens on its own schedule; guessing at weeks only
creates a number to feel behind. What matters is the *order*, and the two external waits
below — those are the only deadlines here that are not self-imposed.

| Phase | Work | Status |
| ----- | ---- | ------ |
| 0 | Firebase/GCP project · publish the privacy policy · **submit the OAuth consent screen with both scopes** · Play account · `eas init` · line up 12 testers | project created 2026-08-12; **consent screen not submitted, sign-in providers not enabled** |
| 1 | Core CRUD, local state, quick capture, the five views | **done 2026-07-28** |
| 2 | Firebase Auth: email/password + Google. **Ends by cutting the first closed-track Play build** | code done 2026-08-07; build not cut |
| 3 | Firestore sync, security rules, offline persistence | code done 2026-08-07 |
| 4 | Calendar + Tasks one-way sync (Cloud Function, refresh token, `invalid_grant` handling) | code done 2026-08-07 |
| 5 | Push notifications, polish, account deletion — in-app **and** the public request URL | deletion + settings done 2026-08-14; notifications not started |
| 6 | Play listing: icon, feature graphic, screenshots, copy, Data safety form | not started |
| 7 | Production-access application + Play review | not started |
| 8 | Web deploy via Firebase Hosting — mostly already done in phase 0 | not started |

> **"Code done" is not "done".** Phases 2–4 are written, typechecked and unit-tested, but not
> one line of them has ever spoken to a real Firebase project, because there isn't one. Every
> claim they make about Google's actual behaviour — that the consent screen returns a refresh
> token, that the rules reject a cross-user read, that an all-day event lands on the right day
> — is unverified until phase 0 exists. Treat them as ready to test, not as working.

### The two waits that are not yours to set

| Wait | Length | Starts when |
| ---- | ------ | ----------- |
| OAuth verification | ~10 days quoted, 5+ weeks reported | the phase 0 consent screen is submitted |
| Play closed test | 14 continuous days, then ≤7 days' review | the first closed-track build reaches 12 testers |

Both are fixed, both are imposed by someone else, and both only begin when you begin them.
Started early they run underneath phases 3–6 and cost nothing. Started late they are pure
addition at the end, because there is no remaining work to hide them behind. **That is the
entire reason phase 0 exists as a phase, and the reason phase 2 ends with a build rather than
with polish** — not a schedule, just an ordering that keeps other people's clocks off the
critical path.

**What changed from the original plan.** Phase 0 lost Apple enrolment and gained privacy-policy
hosting, pulled forward from phase 8 because the consent screen cannot be submitted without a
live URL. Phase 2 lost Sign in with Apple. Phase 6 lost iOS screenshots. Phase 7 lost the
Apple review buffer and gained the Play production-access application. The Play closed-test
requirement was missed entirely when the original table was written — personal developer
accounts created after 13 November 2023 must run a closed test with 12 testers opted in for
14 continuous days before production access can even be applied for.

Full checklist for both clocks, plus the exact consent-screen fields and scope
justifications, is in [`PHASE-0.md`](PHASE-0.md).

---

## Deferred

Known and accepted, not forgotten. Each says what it costs to leave alone, so the choice to
keep deferring stays an informed one.

| # | Item | Why it can wait | Do it by |
| - | ---- | --------------- | -------- |
| ~~D1~~ | ~~Offline writes do not survive a force-quit.~~ **Resolved 2026-08-14** — `src/data/outbox.ts` + `offline-repository.ts`. Writes are appended to a durable per-user queue and replayed on the next connection; `list()` flushes before reading so a pending write is never overwritten by a staler server state. Conflict resolution is last-write-wins, stated rather than pretended. | | |
| D2 | **Swap the privacy-policy contact off a personal Gmail.** Currently `jeeholife2@gmail.com`. | Nothing is published yet, so nothing is exposed yet. | **Phase 6, before anything goes public.** Once live it is scraped and permanent, and changing the consent screen's support email can re-trigger OAuth verification |
| D3 | **Expo 57.0.8 → 57.0.12** (12 packages behind). **Attempted 2026-08-14 and reverted** — see below. | Blocked upstream, not by us. | When `jest-expo` catches up; re-check with `npx expo install --check` |
| D4 | **Sign-in has no deep-linkable URL.** It is a gate component, not a route. | Nothing links to it today. | Whenever password reset or email verification lands — those arrive as links that must land somewhere |
| D5 | **Timed anchors lose their time on the way to Google.** An anchor resolves to an all-day event, matching how a Task resolves to a due date. | Deliberate: one time point is a day, not an interval, and the app should not invent a duration. Exact inside the app either way. | Only if real use shows people want timed blocks — then it is a Layer 2 preference, not a default |

### D3 in detail — why the SDK bump is stuck

`npx expo install --fix` fails with an `ERESOLVE` peer conflict, and it is not a stale
`node_modules`: a full `rm -rf node_modules && npm install` fails identically.

```
react-native@0.86.2
  └─ peerOptional @react-native/jest-preset@0.86.2   ← required exactly
jest-expo@57.0.4
  └─ resolves an older @react-native/jest-preset     ← conflict
```

`react-native@0.86.2` pins `@react-native/jest-preset` to its own exact version, and the
`jest-expo` that Expo wants alongside it has not published a matching release. So the set of
versions Expo itself recommends is currently unsatisfiable.

The escape hatches are `--force` and `--legacy-peer-deps`, and both are refused here on
purpose: they resolve the tree by *ignoring* the constraint, and the constraint is on the Jest
preset — the thing the merge gates run on. A test suite passing under a knowingly wrong
resolution is worse than a stale patch version.

Reverted to the committed lockfile with `npm ci`; 146 tests green. Retry after `jest-expo`
publishes a build matching `react-native` 0.86.2.

## Decision log

| Date | Decision | Consequence |
| ---- | -------- | ----------- |
| 2026-07-27 | Anchor is a real fourth derived type | Four types to design for in list/detail UI |
| 2026-07-27 | Pure Tasks sync via Google Tasks API | Second OAuth scope (`tasks`); submit with `calendar.events` in phase 0 |
| 2026-07-27 | `start`/`end` are a nested `TimePoint { at, precision }`, not four flat fields | An `at` without a precision is unrepresentable. Firestore indexes nested fields via `start.at`, so phase 3 is unaffected |
| 2026-07-27 | camelCase field names everywhere, including Firestore documents | No snake_case↔camelCase mapping layer to get wrong |
| 2026-07-27 | Date-only points store `YYYY-MM-DD`; timed points store UTC ISO | A date-only value has no zone to be wrong about, so "due the 5th" can't drift to the 4th west of UTC |
| 2026-08-07 | Bundle id and Android package are both `com.blueraddish.timeandtimeagain` | Reverse-DNS on a namespace actually controlled. Free to change until the first store upload, permanent after — Play package names can never be renamed or reused |
| 2026-08-07 | Privacy policy hosts on Firebase Hosting (`*.web.app`), pulled forward from phase 8 into phase 0 | `web.app` domains are automatically authorized for their own Firebase project, so no domain purchase and no Search Console verification sits on the critical path |
| 2026-08-07 | Play's 12-tester / 14-day closed test is treated as a second uncontrolled clock | First closed-track build ships when phase 2 lands, not after phase 5 polish — the clock only requires an installable build |
| 2026-08-07 | iOS and the Apple Developer Program are dropped; Android and web only | Deployment-only decision, no code removed. Sign in with Apple and the Apple review buffer lapse; in-app account deletion stays because Play requires it too. Phase 2 keeps the provider list as data so iOS stays cheap to re-add |
| 2026-08-07 | Google sign-in uses `expo-auth-session`, not a native Google SDK | The native libraries support neither web nor Expo Go, and web is a release target. Costs Android's native credential sheet; buys one code path and the phase-4 authorization-code flow from the same library |
| 2026-08-07 | An Anchor resolves to an all-day event, the same way a Task resolves to a due date | Both carry exactly one time point, so both resolve to a day. No invented duration. Timed anchors lose their time of day on the way out — see Deferred D5 |

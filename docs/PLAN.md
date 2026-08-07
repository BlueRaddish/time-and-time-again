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

## 6. Timeline (~8–10 weeks part-time)

| Phase | Work | Time |
| ----- | ---- | ---- |
| 0 | Expo/Firebase/dev accounts setup (Apple Developer $99/yr, Google Play $25 one-time); **submit Google OAuth consent screen for review now** | 3–4 days |
| 1 | Core to-do CRUD, local state, basic UI | 1 week |
| 2 | Firebase Auth: email/password + Google + Apple sign-in | 4–6 days |
| 3 | Firestore sync, security rules, offline persistence | 1 week |
| 4 | Google Calendar one-way sync (Cloud Function, refresh token storage) | 1–1.5 weeks |
| 5 | Push notifications, polish, account deletion flow | 1 week |
| 6 | Store assets: icons, screenshots, privacy policy page, listing copy | 3–5 days |
| 7 | Submission + review buffer (Apple review ~1–3 days; Play a few hours–days; Google OAuth verification runs in parallel from phase 0) | 1 week buffer |
| 8 | Web deploy via Firebase Hosting | 2–3 days (overlaps earlier phases) |

Compressible to ~4–5 weeks at a daily rather than part-time pace.

**Sequencing tip:** submit the Google OAuth consent screen for sensitive-scope
verification in **phase 0**, not phase 4. It runs in the background while everything else
gets built, and it's the one dependency whose timeline you don't control.

### Correction (2026-08-07): there are two such dependencies, not one

Google Play requires personal developer accounts created after 13 November 2023 to run a
**closed test with 12 testers opted in for 14 continuous days** before production access can
even be applied for, and that application is then reviewed for up to 7 days. This was missed
when the timeline above was written.

It behaves exactly like OAuth verification — a fixed wait that only starts when you start it
— so it gets the same treatment: **cut the first closed-track build as soon as phase 2 lands**
rather than after phase 5. The clock requires an installable build, not a finished app.

Full checklist for both, plus the exact consent-screen fields and scope justifications, is in
[`PHASE-0.md`](PHASE-0.md).

---

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

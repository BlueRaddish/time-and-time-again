# Phase 0 — starting the clocks you don't control

Phase 0 is not setup work. Almost everything here could be done in week six without
consequence — **except the two waiting periods below, which cannot be compressed, cannot be
paid to go faster, and run in the background only if they are started now.**

Everything in Track A is free and needs no developer account. Do it first.

---

## The two clocks

| Clock | Length | Starts when | Blocks |
| ----- | ------ | ----------- | ------ |
| **Google OAuth verification** | ~10 days quoted; 5+ weeks reported in practice | The consent screen is submitted with a complete application | Public release of calendar/tasks sync to more than 100 users |
| **Google Play closed testing** | 14 continuous days + up to 7 days' production review | 12 testers have opted in and installed a closed-track build | Any production release on Play |

Neither existed in the original timeline. The Play one is new to this plan — see
[Track C](#track-c--google-play). Together they mean **the earliest honest public release is
about three weeks after the later of the two starts**, regardless of how fast the code goes.

---

## Track A — Google Cloud, Firebase, OAuth (free, do today)

### A1. Firebase project

1. Create a project at <https://console.firebase.google.com>. Suggested id: `time-and-time-again`.
2. Enable **Authentication** → Email/Password, Google, Apple.
3. Enable **Cloud Firestore** in production mode (rules come in phase 3).
4. Enable **Hosting** — needed sooner than phase 8, see A2.
5. Register three apps with the identifiers now in `app.json`:
   - iOS — `com.blueraddish.timeandtimeagain`
   - Android — `com.blueraddish.timeandtimeagain`
   - Web

A Firebase project *is* a Google Cloud project, so this also creates the GCP project the
consent screen lives in. Don't make a separate one.

### A2. Publish the privacy policy

The consent screen cannot be submitted without a **live, public privacy policy URL on a
domain you control**. This is why a slice of phase 8 moves here.

Render `docs/privacy-policy.md` to HTML and deploy it to Firebase Hosting:

```
https://time-and-time-again.web.app/privacy
```

**Why Firebase Hosting rather than GitHub Pages:** Google requires every authorized domain to
be verified in Search Console, but `web.app` and `firebaseapp.com` domains are *automatically
authorized* for their own Firebase project. This removes a domain purchase and a verification
step from the critical path.

Before deploying, fill both placeholders in the policy — `[CONTACT EMAIL]` and `[PUBLIC URL]`
— and set the effective date.

### A3. OAuth consent screen

Google Cloud console → **APIs & Services → OAuth consent screen**. Enable the **Google
Calendar API** and **Google Tasks API** under Enabled APIs first, or the scopes won't be
offerable.

| Field | Value |
| ----- | ----- |
| User type | External |
| App name | Time and Time Again |
| User support email | _(your email)_ |
| App logo | 120×120 PNG. **Uploading a logo triggers brand verification** — but it is required for a published app, so do it now rather than twice |
| Application home page | `https://time-and-time-again.web.app` |
| Privacy policy link | `https://time-and-time-again.web.app/privacy` |
| Terms of service link | Optional; skip |
| Authorized domain | `time-and-time-again.web.app` |
| Developer contact | _(your email)_ |

### A4. Add both scopes — together, in one submission

| Scope | Tier |
| ----- | ---- |
| `https://www.googleapis.com/auth/calendar.events` | Sensitive |
| `https://www.googleapis.com/auth/tasks` | Sensitive |

Both are **sensitive**, not **restricted** — so standard verification applies and no annual
third-party CASA security assessment is required. Keeping out of the restricted tier is the
highest-leverage decision in the whole plan; do not widen either scope.

> **Adding a scope later restarts verification from zero.** `tasks` is not needed until phase
> 4 and it is tempting to leave it out. Don't. It goes in this submission or the whole wait
> happens twice.

Justification text to adapt — Google wants the narrowest true statement, not a pitch:

> **calendar.events** — Time and Time Again is a to-do app in which every entry may carry an
> optional start and end time. When a user gives an entry both a start and an end, or a start
> alone, the app writes exactly that one entry to their Google Calendar so it appears
> alongside the rest of their schedule. The app creates and updates only events it authored
> from the user's own entries, and never reads or alters unrelated events. Timed entries
> become timed events; date-only entries become all-day events.

> **tasks** — Entries that carry a due date but no start time are tasks, not events. Writing
> them to Google Calendar would block time the user has not committed, so the app writes them
> to Google Tasks instead, where the semantics match. The app creates and updates only tasks
> it authored from the user's own entries.

### A5. Record the demo video

Verification stalls here more than anywhere else. Requirements:

- Hosted on YouTube, **public or unlisted** — not a file upload, not Drive.
- Shows the **OAuth consent screen itself**, with the app name and both scopes legible.
- Shows the app's **URL or identity** so the reviewer can tie it to the submission.
- Demonstrates **each scope actually being used** — create a Thing with a time, show the
  event appear in Google Calendar; create a Thing with a due date, show it appear in Google
  Tasks.

**This cannot be recorded until phase 4 works.** That is fine and expected: submit the
consent screen now, and Google will ask for the video during review. Submitting early starts
the queue and the back-and-forth, which is the whole point.

### A6. Expo account

Free. `npx eas init` in the repo to create the project and write `extra.eas.projectId` into
`app.json`. Needed before any build; nothing waits on it.

---

## Track B — Apple Developer ($99/yr)

Start enrollment now; it is not needed until phase 7 but individual enrolment can sit in
identity verification for several days.

1. Enrol at <https://developer.apple.com/programs/> — $99/yr, requires a real legal name and
   a payment method.
2. Once approved, register the bundle ID `com.blueraddish.timeandtimeagain`.
3. Nothing else is needed until phase 7. EAS handles certificates and provisioning.

**No Mac required at any point** — that was the reason for choosing Expo over Flutter.

---

## Track C — Google Play ($25 one-time)

This track is the one the original plan missed.

Personal developer accounts created after 13 November 2023 must run a **closed test with at
least 12 testers opted in for 14 continuous days**, then apply for production access, which
Google reviews in up to 7 days. Organisation accounts and accounts predating that date are
exempt. The requirement was 20 testers until December 2024.

Consequences, in order of how much they change the plan:

1. **Line up 12 people now.** They must each accept the invite and install the build under
   the same Google account they were invited with. Twelve is not many, but finding them takes
   longer than expected, and a tester who never installs does not count.
2. **Cut a closed-track build as early as it will install** — the clock cares that testers
   have the app, not that the app is finished. Phase 1 already builds and runs; realistically
   ship the first closed build the moment phase 2 lands so people have something to sign in
   to. Waiting for phase 5 polish wastes three weeks.
3. **The 14 days must be continuous.** If tester count drops below 12, the clock resets.

Verify the current numbers before relying on them — this rule has changed twice:
<https://support.google.com/googleplay/android-developer/answer/14151465>

---

## The gotcha that will bite in phase 4

While the consent screen's publishing status is **Testing**, refresh tokens issued for
sensitive scopes **expire after 7 days**. The entire sync design in `PLAN.md` §5 depends on a
Cloud Function holding a long-lived refresh token, so during development sync will simply
stop working about once a week until the app is moved to **In production** and verification
completes.

Plan for it rather than debugging it twice:

- Treat weekly re-authorization as normal in development; don't chase it as a bug.
- Handle `invalid_grant` in the Cloud Function from the first commit — surface "reconnect
  your Google account" rather than failing silently.
- It is one more reason the verification clock should already be running.

---

## Done when

- [ ] Firebase project exists; Auth, Firestore and Hosting enabled; three apps registered
- [ ] Privacy policy live at a `web.app` URL, placeholders filled
- [ ] Consent screen submitted with **both** scopes and a logo
- [ ] `npx eas init` has written a project id into `app.json`
- [ ] Apple Developer enrolment submitted
- [ ] Play Console account created, and 12 testers identified by name
- [ ] Demo video deferred to phase 4 — noted, not forgotten

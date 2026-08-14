# Privacy Policy — Time and Time Again

**Effective date:** _(fill in on the day it is first published)_
**Last updated:** 2026-08-07

> **Not yet published.** This is the source text. It must be served at a stable public URL
> before the Google OAuth consent screen can be submitted — see `docs/PHASE-0.md`.
>
> ⚠️ **Swap the contact address before the Play store submission.** `jeeholife2@gmail.com` is a
> personal address standing in for now. Once published it is on a public page, in the Play
> listing, and on the OAuth consent screen — scraped, permanent, and awkward to change later
> because updating the consent screen's support email can re-trigger verification. Move it to a
> dedicated address (a `support@` on a domain, or at minimum a separate mailbox) as part of
> phase 6. Tracked in `PLAN.md` under Deferred.

Time and Time Again ("the app") is a to-do and time-tracking app for Android and the web.
This policy explains what the app collects, why, and what control you have over it.

The app is developed by an individual developer. Contact: **jeeholife2@gmail.com**

---

## What the app collects

**Account information.** When you create an account, the app stores your email address and,
if you sign in with Google, the account identifier Google returns. Passwords are handled
entirely by Firebase Authentication and are never visible to the app or its developer.

**Your content.** The Things you create — titles, notes, start and end times, tags,
completion state and recurrence rules — are stored so they can sync between your devices.

**Google account authorization.** If, and only if, you choose to connect Google Calendar or
Google Tasks, the app stores an OAuth refresh token so it can write your entries to those
services. That token is held server-side in Google Cloud and is never stored on your device
or exposed to the app's front end.

**Technical information.** Crash and error diagnostics may be recorded to keep the app
working.

## What the app does not collect

- No advertising identifiers, and no advertising of any kind.
- No third-party analytics or behavioural tracking.
- No location data.
- No contacts, photos, microphone or camera access.
- Your data is never sold, rented, or shared with third parties for their own purposes.

## How Google user data is used

If you connect your Google account, the app requests two scopes:

| Scope | What it is used for |
| ----- | ------------------- |
| `https://www.googleapis.com/auth/calendar.events` | Creating and updating calendar events that correspond to Things you have given a start time |
| `https://www.googleapis.com/auth/tasks` | Creating and updating tasks that correspond to Things you have given only a due date |

The app writes only entries that originate from your own Things. It does not read, modify or
delete unrelated calendar events or tasks, and it does not use this data to build a profile
of you.

**Limited Use disclosure.** The app's use and transfer of information received from Google
APIs adheres to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including its Limited Use requirements. Specifically, data obtained through these scopes is
used only to provide and improve the app's user-facing sync feature; it is not transferred to
others except as necessary to provide that feature, to comply with applicable law, or as part
of a merger or acquisition with notice to you; it is not used for advertising; and no human
reads it except with your explicit consent, for security purposes, to comply with applicable
law, or where the data has been aggregated and anonymised.

## Where data is stored

Account and Thing data is stored using Google Firebase (Firebase Authentication, Cloud
Firestore) and Google Cloud Functions, running on Google's infrastructure. A copy of your
Things is also held on your device so the app works offline.

## Deleting your data

You can delete your account from inside the app, under **Settings → Delete account**. Doing
so permanently removes your account record, all of your Things, and any stored Google
authorization token. This cannot be undone.

Deleting your account does **not** remove events or tasks the app previously created in your
Google Calendar or Google Tasks — those now belong to your Google account, and you can
delete them there. Disconnecting Google from within the app revokes the stored token so no
further writes are possible.

If you cannot access the app, email **jeeholife2@gmail.com** and your data will be deleted within
30 days.

## Retention

Your data is kept for as long as your account exists. When you delete your account it is
removed from live systems immediately and from routine backups within 30 days.

## Children

The app is not directed to children under 13, and does not knowingly collect personal
information from them.

## Your rights

Depending on where you live, you may have the right to access, correct, export or delete your
personal information. Most of this is available directly in the app; for anything else,
email **jeeholife2@gmail.com**.

## Changes to this policy

If this policy changes materially, the updated version will be posted at **https://timeandtimeagain.web.app/privacy** with
a new effective date, and — where the change is significant — announced in the app.

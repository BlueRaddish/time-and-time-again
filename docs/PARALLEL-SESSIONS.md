# Running ~4 Claude sessions on this repo at once

One git worktree and one branch per session. Sessions never share a working directory, so
they never fight over the filesystem, and `main` is the only integration point.

---

## 1. The four streams

Parallelism only works if the split follows **directory boundaries**. Two sessions editing the
same folder will collide no matter how carefully they're briefed, so ownership is assigned by
path and every stream stays inside its own.

| Stream | Owns (paths) | Phases from `PLAN.md` |
| ------ | ------------ | --------------------- |
| **identity** | `src/app/(auth)/**`, `src/store/auth-provider.tsx`, `src/app/_layout.tsx` | 2, plus the account-deletion flow from 5 |
| **data** | `src/data/**`, `firestore.rules`, `firestore.indexes.json` | 3 |
| **surface** | `src/components/**`, `src/app/{index,calendar,tasks,backlog,everything}.tsx`, `src/lib/format.ts` | 5 polish, calendar timeline, Layer 2 settings |
| **ship** | `app.json`, `eas.json`, `firebase.json`, `functions/**`, `.github/workflows/**`, `assets/**`, store copy | 0, 4 (Cloud Function), 6, 7, 8 |

`src/types/thing.ts`, `src/lib/{time,nl-parse,views}.ts` and `src/store/things-provider.tsx`
are **shared core**. Changing them affects every stream, so they are not owned by anyone —
see the rule in §4.

## 2. The one dependency that isn't free

**data needs a `uid`, which identity produces.** Firestore security rules are scoped by user,
and the repository needs to know whose Things it is reading. That is a real ordering
constraint and pretending otherwise will waste a session.

It is worked around rather than waited on, because the seam already exists:
`ThingsRepository` (`src/data/things-repository.ts`) is an interface, and `ThingsProvider`
already takes a `repository` prop. So **data** builds its Firestore implementation against a
`userId: string` constructor argument and a fake auth value, and wires to the real one when
identity lands. No blocking, and the integration is a one-line change.

Everything else is genuinely independent. **surface** and **ship** have no cross-dependency
at all and can run start to finish in parallel.

> Worth saying plainly: four sessions on a codebase this young has real overhead — most of
> the churn below is hot-file churn, not feature work. Two sessions (identity+data, and
> surface+ship as one each) would move nearly as fast with a fraction of the merge pain.
> Four is fine if the point is practice at coordinating them, which it is.

## 3. Per-session setup

Each worktree needs its own `node_modules` and its own Metro port. Metro defaults to 8081 for
everyone, so **two sessions started naively will silently serve each other's bundles.**

| Stream | Worktree | Branch | Metro port |
| ------ | -------- | ------ | ---------- |
| identity | `../ttag-identity` | `stream/identity` | 8081 |
| data | `../ttag-data` | `stream/data` | 8082 |
| surface | `../ttag-surface` | `stream/surface` | 8083 |
| ship | `../ttag-ship` | `stream/ship` | 8084 |

Use the helper rather than doing it by hand:

```powershell
.\scripts\new-session.ps1 -Stream identity
```

It creates the worktree off current `main`, installs dependencies, and prints the port and the
opening prompt for that session. Run `npm run web -- --port <port>` inside the worktree.

If a stream runs the Firebase emulator suite, it must also offset the emulator ports in
`firebase.json` locally — the defaults collide the same way.

## 4. Hot files — where collisions actually happen

Four files get touched by more than one stream. Each needs a rule, or every merge is a
conflict.

**`package.json` / `package-lock.json`** — every stream adds dependencies.
- Always `npx expo install <pkg>`, never hand-edit a version. Expo pins SDK-compatible ranges,
  and a hand-picked version will break someone else's build.
- On a lockfile conflict: `git checkout --theirs package-lock.json && npm install`. Never
  hand-merge a lockfile.

**`src/app/_layout.tsx`** — the provider tree. **identity** owns it outright. If another
stream needs a provider mounted, it asks rather than edits.

**`app.json`** — **ship** owns it. identity requests plugin entries (Google/Apple sign-in both
need config here) instead of adding them.

**`docs/PLAN.md`** — the decision log is **append-only, one row per line, always at the end of
the table**. Git merges that cleanly. Rewriting or reordering existing rows does not.

**Shared core** (`src/types/thing.ts`, `src/lib/{time,nl-parse,views}.ts`,
`src/store/things-provider.tsx`) — no stream changes these unilaterally. A change here ripples
through all four. Raise it, land it on `main` as its own small commit, and have everyone
rebase before continuing.

## 5. The registry

`working.md` at the repo root (gitignored) is the shared whiteboard: who is doing what, right
now. Every session updates its own row when it starts and when it lands something.

It is gitignored deliberately — it is coordination state, not project history, and committing
it would itself become a merge conflict on every branch.

Each session should read it at the start of a task and before merging.

## 6. Integration cadence

- **Rebase on `main` at the start of every session**, and again immediately before merging.
- **Merge when a vertical slice works, not when a phase finishes.** A branch that lives longer
  than about a day stops being parallel work and starts being a fork.
- **Typecheck before merging**: `npx tsc --noEmit` must be clean. It is the only gate that
  catches a shared-core change breaking another stream, since there are no tests yet.
- Merge into `main` directly. PR review between four sessions driven by one person is
  ceremony, not safety.

```powershell
git fetch origin
git rebase origin/main          # in the stream worktree
npx tsc --noEmit
git switch main                 # in the primary worktree
git merge --no-ff stream/identity
```

## 7. Briefing a session

Give each session its stream name, and point it at three things: this file, `docs/PLAN.md`,
and `working.md`. The opening prompt that works:

> You are the **\<stream\>** session for this project. Read `docs/PARALLEL-SESSIONS.md`,
> `docs/PLAN.md`, and `working.md` first. You own only the paths listed for your stream — if
> you need a change outside them, note it in `working.md` and raise it rather than editing.
> Register your scope in `working.md` before starting.

## 8. First thing to do before splitting

There are no tests. With one session that is a known gap; with four it is a real hazard,
because nothing will catch one stream breaking another's assumptions about the shared core.

**Set up Jest and cover `deriveThingType` and `parseCapture` on `main` before spinning up the
worktrees.** They are pure functions, it is an hour of work, and it is the only automated
signal the four streams will share.

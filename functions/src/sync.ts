/**
 * What to do to Google when a Thing changes — decided as pure data, executed elsewhere.
 *
 * Keeping the decision separate from the HTTP calls is what makes the two genuinely tricky
 * cases testable:
 *
 *   1. **The write-back loop.** Executing a sync stores the new external id back onto the
 *      Thing, which is itself a write, which fires this trigger again. Left alone that is an
 *      infinite loop billed by the invocation. `planSync` returns `none` when nothing a remote
 *      service cares about has changed, and that is the guard.
 *
 *   2. **A Thing changing type.** Give a Task a start time and it becomes an Event: it now
 *      belongs on the calendar and must stop being a task. That is a delete *and* a create
 *      against two different APIs, and forgetting the delete leaves a duplicate behind forever.
 */

import { deriveThingType, syncTargetFor, type Thing } from './thing';

export type SyncTargetName = 'calendar' | 'tasks';

/** Where a Thing currently lives remotely: `calendar:<eventId>` or `tasks:<taskId>`. */
export type SyncRef = { target: SyncTargetName; id: string };

export function formatSyncRef(ref: SyncRef): string {
  return `${ref.target}:${ref.id}`;
}

export function parseSyncRef(value: string | null | undefined): SyncRef | null {
  if (!value) return null;
  const separator = value.indexOf(':');
  if (separator <= 0) return null;

  const target = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id) return null;
  if (target !== 'calendar' && target !== 'tasks') return null;

  return { target, id };
}

export type SyncAction =
  | { kind: 'none' }
  | { kind: 'create'; target: SyncTargetName }
  | { kind: 'update'; ref: SyncRef }
  | { kind: 'delete'; ref: SyncRef }
  /** Type changed: remove from where it was, then create where it now belongs. */
  | { kind: 'move'; from: SyncRef; to: SyncTargetName };

/** The fields a remote copy actually reflects. Anything else changing is not worth a call. */
function syncRelevant(thing: Thing): string {
  return JSON.stringify([
    thing.title,
    thing.notes,
    thing.start,
    thing.end,
    thing.completedAt,
  ]);
}

export function hasSyncRelevantChange(before: Thing, after: Thing): boolean {
  return syncRelevant(before) !== syncRelevant(after);
}

/**
 * @param before the Thing as it was, or null on creation
 * @param after  the Thing as it now is, or null on deletion
 */
export function planSync(before: Thing | null, after: Thing | null): SyncAction {
  // Deleted: remove the remote copy if there was one.
  if (!after) {
    const ref = parseSyncRef(before?.calendarSyncId);
    return ref ? { kind: 'delete', ref } : { kind: 'none' };
  }

  const target = syncTargetFor(deriveThingType(after));
  const ref = parseSyncRef(after.calendarSyncId);

  // Became a Note, or never was anything else: drop any remote copy.
  if (target === 'none') {
    return ref ? { kind: 'delete', ref } : { kind: 'none' };
  }

  if (!ref) {
    // Nothing remote yet. On an update with no relevant change this would be a Thing that has
    // simply never synced -- still worth creating, so no change check here.
    return { kind: 'create', target };
  }

  if (ref.target !== target) {
    return { kind: 'move', from: ref, to: target };
  }

  // Same target, already synced: only touch Google if something it shows has changed. This is
  // the branch that stops the write-back loop.
  if (before && !hasSyncRelevantChange(before, after)) {
    return { kind: 'none' };
  }

  return { kind: 'update', ref };
}

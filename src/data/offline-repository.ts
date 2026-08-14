/**
 * Offline-first persistence: a local mirror for reads, a durable outbox for writes.
 *
 * Supersedes the read-only cache this file used to hold. The mirror answers `list()` when the
 * network is gone; the outbox (`outbox.ts`) makes writes survive the app being killed, which
 * the Firestore SDK's in-memory queue does not.
 *
 * ## What a write does
 *
 *   1. Update the local mirror. Always, first, unconditionally — this is what the user sees.
 *   2. Try the server.
 *   3. If that fails transiently, queue the op and **resolve anyway**. From the caller's point
 *      of view the write succeeded, because it did: it is on disk and it will be delivered.
 *
 * A permanent failure — permission denied, invalid argument — is *not* queued. Replaying it
 * forever would block every write behind it, and it will never succeed.
 *
 * ## Conflict resolution is last-write-wins
 *
 * Two devices editing one Thing offline will resolve to whichever syncs later. For a personal
 * to-do list that is the honest trade; anything better needs per-field versioning, and the
 * cost of that is not repaid here.
 */

import type { CacheRepository } from '@/data/async-storage-repository';
import { compactOutbox, type Outbox, type OutboxOp } from '@/data/outbox';
import type { ThingsRepository } from '@/data/things-repository';
import type { Thing, ThingPatch } from '@/types/thing';

/** Firestore surfaces a `code`; anything else is treated as a network problem, so it retries. */
const PERMANENT_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'failed-precondition',
  'out-of-range',
  'unimplemented',
]);

export function isTransientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return true;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') return true;
  return !PERMANENT_CODES.has(code);
}

/** Deleting something already gone is the state we wanted. */
function isAlreadyGone(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'not-found'
  );
}

export type OfflineRepository = ThingsRepository & {
  /** Replays queued writes. Safe to call at any time; does nothing when the queue is empty. */
  flush: () => Promise<{ delivered: number; remaining: number }>;
};

export function createOfflineRepository(
  remote: ThingsRepository,
  cache: CacheRepository,
  outbox: Outbox
): OfflineRepository {
  async function applyRemote(op: OutboxOp): Promise<void> {
    switch (op.kind) {
      case 'create':
        return remote.create(op.thing);
      case 'update':
        return remote.update(op.id, op.patch);
      case 'remove':
        return remote.remove(op.id);
    }
  }

  async function flush(): Promise<{ delivered: number; remaining: number }> {
    const queued = compactOutbox(await outbox.list());
    if (queued.length === 0) return { delivered: 0, remaining: 0 };

    let delivered = 0;

    for (let index = 0; index < queued.length; index += 1) {
      const op = queued[index];
      if (!op) continue;
      try {
        await applyRemote(op);
        delivered += 1;
      } catch (error) {
        if (isAlreadyGone(error) && op.kind === 'remove') {
          delivered += 1;
          continue;
        }

        if (isTransientError(error)) {
          // Still offline. Keep this op and everything after it, in order — replaying a later
          // write before an earlier one on the same Thing would resurrect stale data.
          const remaining = queued.slice(index);
          await outbox.replaceAll(remaining);
          return { delivered, remaining: remaining.length };
        }

        // Permanent: drop it rather than wedge the queue behind something that can never land.
        console.warn('[outbox] dropping an operation that can never succeed', op.kind, error);
        delivered += 1;
      }
    }

    await outbox.replaceAll([]);
    return { delivered, remaining: 0 };
  }

  async function attempt(op: OutboxOp): Promise<void> {
    try {
      await applyRemote(op);
    } catch (error) {
      if (isAlreadyGone(error) && op.kind === 'remove') return;

      if (!isTransientError(error)) {
        // The caller deserves to know a write was rejected outright rather than delayed.
        throw error;
      }
      await outbox.append(op);
    }
  }

  return {
    async list(): Promise<Thing[]> {
      // Deliver queued writes before reading, or the read would overwrite the mirror with a
      // server state that predates them and the pending edits would vanish from the screen.
      await flush().catch(() => undefined);

      try {
        const things = await remote.list();
        await cache.replaceAll(things);
        return things;
      } catch (error) {
        console.warn('[things] remote list failed, serving the local mirror', error);
        return cache.list();
      }
    },

    async create(thing: Thing): Promise<void> {
      await cache.create(thing);
      await attempt({ kind: 'create', id: thing.id, thing });
    },

    async update(id: string, patch: ThingPatch): Promise<void> {
      await cache.update(id, patch);
      await attempt({ kind: 'update', id, patch });
    },

    async remove(id: string): Promise<void> {
      await cache.remove(id);
      await attempt({ kind: 'remove', id });
    },

    flush,
  };
}

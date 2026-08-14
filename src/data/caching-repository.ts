/**
 * Offline reads, by mirroring Firestore into device storage.
 *
 * ## Why this exists at all
 *
 * The Firebase JS SDK's own offline persistence is built on IndexedDB, which exists on web and
 * not in React Native. The native-module SDK (`@react-native-firebase`) has real offline
 * persistence but does not run on web — and web is a release target here. So the JS SDK stays,
 * and the gap is filled by mirroring every read and write into the AsyncStorage repository
 * that phase 1 already had.
 *
 * ## What this does and does not give you
 *
 * **Reads work offline.** `list()` returns the mirror immediately when Firestore is
 * unreachable, so the app opens to your Things on a plane instead of to an empty list.
 *
 * **Writes work offline within a session.** The Firestore SDK queues writes in memory and
 * flushes them on reconnect, and the mirror is updated at the same time so the UI is correct
 * either way.
 *
 * **Writes do not survive being killed while offline.** If the app is force-quit before
 * Firestore reconnects, the queued write is gone from the SDK while the mirror still shows it
 * — the mirror will then be overwritten by the next successful `list()`. Closing that gap
 * needs a real outbox with per-record sync state and conflict resolution, which is a phase-5
 * item and not something to fake here. The failure is silent-ish and worth knowing about.
 */

import type { CacheRepository } from '@/data/async-storage-repository';
import type { ThingsRepository } from '@/data/things-repository';
import type { Thing, ThingPatch } from '@/types/thing';

export function createCachingRepository(
  remote: ThingsRepository,
  cache: CacheRepository
): ThingsRepository {
  return {
    async list(): Promise<Thing[]> {
      try {
        const things = await remote.list();
        // Write-through so the next offline open has the current set.
        await cache.replaceAll(things);
        return things;
      } catch (error) {
        console.warn('[things] remote list failed, serving cache', error);
        return cache.list();
      }
    },

    async create(thing: Thing): Promise<void> {
      // Cache first, always. If the remote call throws, the Thing is still on screen and still
      // on disk, which is the behaviour a user expects from a to-do app that lost signal.
      await cache.create(thing);
      await remote.create(thing);
    },

    async update(id: string, patch: ThingPatch): Promise<void> {
      await cache.update(id, patch);
      await remote.update(id, patch);
    },

    async remove(id: string): Promise<void> {
      await cache.remove(id);
      await remote.remove(id);
    },
  };
}

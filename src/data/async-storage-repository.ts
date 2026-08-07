/**
 * Device-local persistence.
 *
 * Phase 1 used this as *the* store. Phase 3 keeps it and gives it a second job: it is also the
 * offline cache sitting in front of Firestore (see `caching-repository.ts`). Both jobs want
 * the same operations, so it stayed one implementation with a configurable key.
 *
 * The whole collection lives under one key. That is still fine — it is a personal to-do list,
 * not a dataset — and it makes the write-through mirror in the cache a single `setItem`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ThingsRepository } from '@/data/things-repository';
import type { Thing, ThingPatch } from '@/types/thing';

/** Versioned so a future shape change can migrate rather than silently misread. */
const DEFAULT_KEY = 'ttag:things:v1';

/**
 * Per-user cache key.
 *
 * Signed-in data must not land in the signed-out store, and two accounts on one device must
 * not see each other's Things — the cache is read before any Firestore rule can be consulted,
 * so separation here is the only thing enforcing it locally.
 */
export function cacheKeyForUser(uid: string): string {
  return `${DEFAULT_KEY}:${uid}`;
}

/** Adds bulk replacement, which the cache needs and the plain repository interface does not. */
export interface CacheRepository extends ThingsRepository {
  replaceAll(things: Thing[]): Promise<void>;
  clear(): Promise<void>;
}

export function createAsyncStorageRepository(storageKey: string = DEFAULT_KEY): CacheRepository {
  async function readAll(): Promise<Thing[]> {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return [];

    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Thing[]) : [];
    } catch {
      // Corrupt payload: start clean rather than wedging the app on every launch.
      console.warn(`[things] discarding unreadable payload at ${storageKey}`);
      return [];
    }
  }

  async function writeAll(things: Thing[]): Promise<void> {
    await AsyncStorage.setItem(storageKey, JSON.stringify(things));
  }

  return {
    list: readAll,

    async create(thing) {
      const things = await readAll();
      await writeAll([...things, thing]);
    },

    async update(id, patch: ThingPatch) {
      const things = await readAll();
      await writeAll(
        things.map((thing) =>
          thing.id === id ? { ...thing, ...patch, updatedAt: new Date().toISOString() } : thing
        )
      );
    },

    async remove(id) {
      const things = await readAll();
      await writeAll(things.filter((thing) => thing.id !== id));
    },

    replaceAll: writeAll,

    async clear() {
      await AsyncStorage.removeItem(storageKey);
    },
  };
}

/** The signed-out store. Keeps the original key so phase-1 data survives the upgrade. */
export const asyncStorageRepository = createAsyncStorageRepository();

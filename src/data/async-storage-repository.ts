/**
 * Local-only persistence for phase 1.
 *
 * The whole collection lives under one key. That is fine while the app is single-user and
 * local; it is exactly what phase 3 replaces with Firestore, behind the same interface.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ThingsRepository } from '@/data/things-repository';
import type { Thing, ThingPatch } from '@/types/thing';

/** Versioned so a future shape change can migrate rather than silently misread. */
const STORAGE_KEY = 'ttag:things:v1';

async function readAll(): Promise<Thing[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Thing[]) : [];
  } catch {
    // Corrupt payload: start clean rather than wedging the app on every launch.
    console.warn(`[things] discarding unreadable payload at ${STORAGE_KEY}`);
    return [];
  }
}

async function writeAll(things: Thing[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(things));
}

export const asyncStorageRepository: ThingsRepository = {
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
};

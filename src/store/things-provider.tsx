/**
 * The single source of Things for the whole app.
 *
 * State is held in memory and written through to the repository on every mutation. Screens
 * never touch storage — they filter what this provides.
 */

import * as Crypto from 'expo-crypto';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { asyncStorageRepository } from '@/data/async-storage-repository';
import type { ThingsRepository } from '@/data/things-repository';
import type { NewThing, Thing, ThingPatch } from '@/types/thing';

type ThingsContextValue = {
  things: Thing[];
  loading: boolean;
  addThing: (input: NewThing) => Promise<Thing>;
  updateThing: (id: string, patch: ThingPatch) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  removeThing: (id: string) => Promise<void>;
};

const ThingsContext = createContext<ThingsContextValue | null>(null);

export function ThingsProvider({
  children,
  repository = asyncStorageRepository,
}: {
  children: ReactNode;
  /** Injectable so phase 3 can swap in Firestore, and so tests can pass a fake. */
  repository?: ThingsRepository;
}) {
  const [things, setThings] = useState<Thing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    repository
      .list()
      .then((stored) => {
        if (active) setThings(stored);
      })
      .catch((error) => {
        console.warn('[things] failed to load', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [repository]);

  const addThing = useCallback(
    async (input: NewThing): Promise<Thing> => {
      const now = new Date().toISOString();
      const thing: Thing = {
        id: Crypto.randomUUID(),
        title: input.title,
        notes: input.notes ?? null,
        start: input.start ?? null,
        end: input.end ?? null,
        completedAt: null,
        tags: input.tags ?? [],
        recurrenceRule: null,
        calendarSyncId: null,
        createdAt: now,
        updatedAt: now,
      };

      setThings((current) => [...current, thing]);
      await repository.create(thing);
      return thing;
    },
    [repository]
  );

  const updateThing = useCallback(
    async (id: string, patch: ThingPatch) => {
      const updatedAt = new Date().toISOString();
      setThings((current) =>
        current.map((thing) => (thing.id === id ? { ...thing, ...patch, updatedAt } : thing))
      );
      await repository.update(id, patch);
    },
    [repository]
  );

  const removeThing = useCallback(
    async (id: string) => {
      setThings((current) => current.filter((thing) => thing.id !== id));
      await repository.remove(id);
    },
    [repository]
  );

  /**
   * Completion applies to any Thing, not just task-like ones — Layer 0 behaviour: you check
   * something off and it's done, regardless of which fields it happens to have.
   */
  const toggleComplete = useCallback(
    async (id: string) => {
      const target = things.find((thing) => thing.id === id);
      if (!target) return;
      await updateThing(id, {
        completedAt: target.completedAt ? null : new Date().toISOString(),
      });
    },
    [things, updateThing]
  );

  const value = useMemo(
    () => ({ things, loading, addThing, updateThing, toggleComplete, removeThing }),
    [things, loading, addThing, updateThing, toggleComplete, removeThing]
  );

  return <ThingsContext.Provider value={value}>{children}</ThingsContext.Provider>;
}

export function useThings(): ThingsContextValue {
  const context = useContext(ThingsContext);
  if (!context) {
    throw new Error('useThings must be used inside a ThingsProvider');
  }
  return context;
}

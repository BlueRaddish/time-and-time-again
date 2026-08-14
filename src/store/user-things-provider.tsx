/**
 * Picks which store the app is reading, based on who is signed in.
 *
 * This is the seam `PARALLEL-SESSIONS.md` §2 was designed around: `ThingsProvider` already
 * took a repository, so wiring the real one in is this file and nothing else.
 *
 * Three cases:
 *   - no Firebase project configured  → device-local, phase-1 behaviour
 *   - configured but nobody signed in → device-local (the sign-in gate is up, so unreachable)
 *   - signed in                       → Firestore, with a local mirror and a durable outbox
 *
 * The mirror and the outbox are both keyed by uid. Two accounts on one device must not read
 * each other's Things, and must not deliver each other's queued writes.
 */

import { useMemo, type ReactNode } from 'react';

import {
  asyncStorageRepository,
  cacheKeyForUser,
  createAsyncStorageRepository,
} from '@/data/async-storage-repository';
import { createAsyncStorageOutbox, outboxKeyForUser } from '@/data/async-storage-outbox';
import { createFirestoreRepository } from '@/data/firestore-repository';
import { createOfflineRepository } from '@/data/offline-repository';
import type { ThingsRepository } from '@/data/things-repository';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/store/auth-provider';
import { ThingsProvider } from '@/store/things-provider';

export function UserThingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const repository = useMemo<ThingsRepository>(() => {
    const firebase = getFirebase();
    if (!firebase || !uid) return asyncStorageRepository;

    return createOfflineRepository(
      createFirestoreRepository(firebase.db, uid),
      createAsyncStorageRepository(cacheKeyForUser(uid)),
      createAsyncStorageOutbox(outboxKeyForUser(uid))
    );
  }, [uid]);

  /**
   * The key remounts `ThingsProvider` when the user changes. Without it, the in-memory list
   * from the previous account survives the swap and the new user briefly sees someone else's
   * Things — the repository would be right and the screen still wrong.
   */
  return (
    <ThingsProvider key={uid ?? 'local'} repository={repository}>
      {children}
    </ThingsProvider>
  );
}

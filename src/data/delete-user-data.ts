/**
 * Erasing everything a user has stored.
 *
 * Google Play requires any app that offers account creation to offer in-app deletion, and
 * dropping iOS did not remove that obligation (`docs/PHASE-0.md`, Track B). Phase 5 builds the
 * screen; this is the part it calls.
 *
 * ## Why this runs before the auth record is deleted
 *
 * Firestore rules are scoped by `request.auth.uid`. Once the auth record is gone the client
 * has no uid, so the documents become permanently unreachable — orphaned rather than deleted.
 * Data first, identity second, always.
 */

import { collection, deleteDoc, getDocs, type Firestore } from 'firebase/firestore';

import { cacheKeyForUser, createAsyncStorageRepository } from '@/data/async-storage-repository';

/**
 * Deletes every Thing the user owns.
 *
 * Deliberately not batched: a personal to-do list is small, batching adds a 500-operation
 * chunking rule to get wrong, and a partial failure here is safe to retry — deleting an
 * already-deleted document is not an error.
 */
export async function deleteAllThings(db: Firestore, userId: string): Promise<void> {
  const snapshot = await getDocs(collection(db, 'users', userId, 'things'));
  await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
}

/** Remote documents plus the local mirror. Leaving the mirror behind would resurrect the list. */
export async function deleteAllUserData(db: Firestore, userId: string): Promise<void> {
  await deleteAllThings(db, userId);
  await createAsyncStorageRepository(cacheKeyForUser(userId)).clear();
}

/**
 * Firestore implementation of the persistence boundary.
 *
 * ## Shape
 *
 * `users/{uid}/things/{thingId}` — a subcollection under the owner rather than a flat
 * `things` collection with a `userId` field. Two reasons: the security rule becomes a path
 * match instead of a field comparison (harder to get wrong, and it cannot be bypassed by a
 * query that forgets its `where`), and deleting an account is a subtree delete.
 *
 * The document is the `Thing` minus its `id`, which is the document id. Field names are
 * camelCase and nested `TimePoint`s are stored as nested maps — both per the decision log
 * (2026-07-27). Firestore indexes `start.at` natively, so nothing is lost by nesting.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  type CollectionReference,
  type Firestore,
} from 'firebase/firestore';

import type { ThingsRepository } from '@/data/things-repository';
import type { Thing, ThingPatch } from '@/types/thing';

/** Everything but the id, which Firestore carries as the document key. */
type ThingDocument = Omit<Thing, 'id'>;

function toDocument(thing: Thing): ThingDocument {
  const { id: _id, ...document } = thing;
  return document;
}

/**
 * Defaults are applied on read rather than trusted from the document: a Thing written by an
 * older build, or by the phase-4 Cloud Function, may predate a field. A missing `tags` should
 * be an empty list, not `undefined` leaking into the UI.
 */
function fromDocument(id: string, data: Record<string, unknown>): Thing {
  const document = data as Partial<ThingDocument>;
  return {
    id,
    title: document.title ?? '',
    notes: document.notes ?? null,
    start: document.start ?? null,
    end: document.end ?? null,
    completedAt: document.completedAt ?? null,
    tags: document.tags ?? [],
    recurrenceRule: document.recurrenceRule ?? null,
    calendarSyncId: document.calendarSyncId ?? null,
    createdAt: document.createdAt ?? new Date(0).toISOString(),
    updatedAt: document.updatedAt ?? new Date(0).toISOString(),
  };
}

export function createFirestoreRepository(db: Firestore, userId: string): ThingsRepository {
  if (!userId) {
    // A repository with no user would read and write a path of `users//things`, which
    // Firestore accepts as a different collection entirely. Fail here instead.
    throw new Error('createFirestoreRepository requires a signed-in user id');
  }

  const things = (): CollectionReference => collection(db, 'users', userId, 'things');

  return {
    async list() {
      const snapshot = await getDocs(things());
      return snapshot.docs.map((entry) => fromDocument(entry.id, entry.data()));
    },

    async create(thing) {
      // setDoc with an explicit id, not addDoc: the id is generated client-side so the
      // optimistic row in the store and the document are the same object from the start.
      await setDoc(doc(things(), thing.id), toDocument(thing));
    },

    async update(id, patch: ThingPatch) {
      await updateDoc(doc(things(), id), { ...patch, updatedAt: new Date().toISOString() });
    },

    async remove(id) {
      await deleteDoc(doc(things(), id));
    },
  };
}

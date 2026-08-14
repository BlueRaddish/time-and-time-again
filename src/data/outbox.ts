/**
 * Writes that have not reached the server yet — the shape and the rules, with no storage.
 *
 * Split from its AsyncStorage implementation (`async-storage-outbox.ts`) the same way
 * `things-repository.ts` is split from `async-storage-repository.ts`: the interesting logic is
 * `compactOutbox`, and it should be testable without a device.
 *
 * ## The gap this closes
 *
 * The Firestore JS SDK queues offline writes **in memory** and flushes them on reconnect. Kill
 * the app before that happens and the write is gone, while the local mirror still shows it —
 * until the next successful read silently overwrites it. A to-do app that loses what you typed
 * on the subway is not a to-do app.
 *
 * So every mutation is also appended here, to disk, and replayed on the next connection.
 * Firestore's own queue still does its job; this one survives being killed.
 *
 * ## Replay must be idempotent
 *
 * An op can be replayed after it actually succeeded — the write landed, the app died before
 * the queue entry was removed. Every op is therefore safe twice: `create` uses `setDoc` with a
 * known id, `update` is a field merge, and `remove` treats a missing document as success.
 */

import type { Thing, ThingPatch } from '@/types/thing';

export type OutboxOp =
  | { kind: 'create'; id: string; thing: Thing }
  | { kind: 'update'; id: string; patch: ThingPatch }
  | { kind: 'remove'; id: string };

export interface Outbox {
  list(): Promise<OutboxOp[]>;
  append(op: OutboxOp): Promise<void>;
  replaceAll(ops: OutboxOp[]): Promise<void>;
}

/**
 * Collapses a queue to the fewest operations with the same end state.
 *
 * The interesting case is a Thing created *and* deleted while offline: the server never heard
 * of it, so replaying `create` then `remove` would make a document appear and vanish for every
 * other device watching. Both ops are dropped instead.
 *
 * Order between different ids is preserved by first touch, so replay stays predictable.
 */
export function compactOutbox(ops: OutboxOp[]): OutboxOp[] {
  const order: string[] = [];
  const byId = new Map<string, OutboxOp | null>();

  for (const op of ops) {
    if (!byId.has(op.id)) order.push(op.id);
    const existing = byId.get(op.id) ?? null;

    if (op.kind === 'create') {
      byId.set(op.id, op);
      continue;
    }

    if (op.kind === 'update') {
      if (existing?.kind === 'create') {
        // Fold the edit into the pending create: one write instead of two.
        byId.set(op.id, {
          kind: 'create',
          id: op.id,
          thing: { ...existing.thing, ...op.patch },
        });
      } else if (existing?.kind === 'update') {
        byId.set(op.id, { kind: 'update', id: op.id, patch: { ...existing.patch, ...op.patch } });
      } else if (existing?.kind === 'remove') {
        // Editing something already queued for deletion: deletion wins, since that is what the
        // user asked for last.
        byId.set(op.id, existing);
      } else {
        byId.set(op.id, op);
      }
      continue;
    }

    // remove
    if (existing?.kind === 'create') {
      // Created and deleted before either reached the server. Nothing to say.
      byId.set(op.id, null);
    } else {
      byId.set(op.id, op);
    }
  }

  const result: OutboxOp[] = [];
  for (const id of order) {
    const op = byId.get(id);
    if (op) result.push(op);
  }
  return result;
}

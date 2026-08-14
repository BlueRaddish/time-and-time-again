/**
 * The outbox, on disk.
 *
 * Surviving a force-quit is the entire point, so this is the one part that must be durable
 * rather than in memory. The rules it enforces live in `outbox.ts`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { compactOutbox, type Outbox, type OutboxOp } from '@/data/outbox';

const KEY_PREFIX = 'ttag:outbox:v1';

/** Per-user, so two accounts on one device never deliver each other's queued writes. */
export function outboxKeyForUser(uid: string): string {
  return `${KEY_PREFIX}:${uid}`;
}

export function createAsyncStorageOutbox(storageKey: string): Outbox {
  async function read(): Promise<OutboxOp[]> {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxOp[]) : [];
    } catch {
      // An unreadable queue is lost work, but a permanently wedged one blocks every future
      // write. Drop it, and say so rather than failing silently.
      console.warn(`[outbox] discarding unreadable queue at ${storageKey}`);
      return [];
    }
  }

  async function write(ops: OutboxOp[]): Promise<void> {
    await AsyncStorage.setItem(storageKey, JSON.stringify(ops));
  }

  return {
    list: read,
    replaceAll: write,
    async append(op) {
      // Compacting on append keeps the queue proportional to the number of distinct Things
      // touched rather than to keystrokes, which matters over a long offline stretch.
      await write(compactOutbox([...(await read()), op]));
    },
  };
}

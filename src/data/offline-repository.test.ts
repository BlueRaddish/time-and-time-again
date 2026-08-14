import type { CacheRepository } from '@/data/async-storage-repository';
import { createOfflineRepository, isTransientError } from '@/data/offline-repository';
import type { Outbox, OutboxOp } from '@/data/outbox';
import type { ThingsRepository } from '@/data/things-repository';
import type { Thing } from '@/types/thing';

function thing(id: string, title = id): Thing {
  return {
    id,
    title,
    notes: null,
    start: null,
    end: null,
    completedAt: null,
    tags: [],
    recurrenceRule: null,
    calendarSyncId: null,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
  };
}

function firestoreError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function fakeCache(initial: Thing[] = []): CacheRepository & { contents: () => Thing[] } {
  let items = [...initial];
  return {
    contents: () => items,
    list: async () => [...items],
    create: async (t) => {
      items = [...items, t];
    },
    update: async (id, patch) => {
      items = items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    },
    remove: async (id) => {
      items = items.filter((it) => it.id !== id);
    },
    replaceAll: async (next) => {
      items = [...next];
    },
    clear: async () => {
      items = [];
    },
  };
}

function fakeOutbox(): Outbox & { contents: () => OutboxOp[] } {
  let ops: OutboxOp[] = [];
  return {
    contents: () => ops,
    list: async () => [...ops],
    append: async (op) => {
      ops = [...ops, op];
    },
    replaceAll: async (next) => {
      ops = [...next];
    },
  };
}

/** A remote that is offline until `online` is flipped. */
function flakyRemote(initial: Thing[] = []) {
  let items = [...initial];
  let online = false;

  const guard = () => {
    if (!online) throw firestoreError('unavailable');
  };

  return {
    contents: () => items,
    goOnline: () => {
      online = true;
    },
    repository: {
      list: async () => {
        guard();
        return [...items];
      },
      create: async (t: Thing) => {
        guard();
        items = [...items, t];
      },
      update: async (id: string, patch: Partial<Thing>) => {
        guard();
        items = items.map((it) => (it.id === id ? { ...it, ...patch } : it));
      },
      remove: async (id: string) => {
        guard();
        items = items.filter((it) => it.id !== id);
      },
    } as ThingsRepository,
  };
}

describe('isTransientError', () => {
  it.each(['unavailable', 'deadline-exceeded', 'internal', 'aborted', 'resource-exhausted'])(
    'retries %s',
    (code) => {
      expect(isTransientError(firestoreError(code))).toBe(true);
    }
  );

  it.each(['permission-denied', 'unauthenticated', 'invalid-argument', 'failed-precondition'])(
    'never retries %s',
    (code) => {
      // Replaying these forever would wedge every later write behind one that cannot land.
      expect(isTransientError(firestoreError(code))).toBe(false);
    }
  );

  it('treats an error with no code as a network problem', () => {
    expect(isTransientError(new Error('socket hang up'))).toBe(true);
    expect(isTransientError(null)).toBe(true);
  });
});

describe('createOfflineRepository — writing while offline', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('resolves a write that could not reach the server', async () => {
    // The old caching repository rejected here. It must not: the write is on disk and will be
    // delivered, so from the caller's side it succeeded.
    const repo = createOfflineRepository(flakyRemote().repository, fakeCache(), fakeOutbox());
    await expect(repo.create(thing('a'))).resolves.toBeUndefined();
  });

  it('queues the write and keeps it in the mirror', async () => {
    const cache = fakeCache();
    const outbox = fakeOutbox();
    const repo = createOfflineRepository(flakyRemote().repository, cache, outbox);

    await repo.create(thing('a'));

    expect(cache.contents().map((t) => t.id)).toEqual(['a']);
    expect(outbox.contents()).toEqual([{ kind: 'create', id: 'a', thing: thing('a') }]);
  });

  it('delivers everything queued once the network returns', async () => {
    const remote = flakyRemote();
    const outbox = fakeOutbox();
    const repo = createOfflineRepository(remote.repository, fakeCache(), outbox);

    await repo.create(thing('a'));
    await repo.create(thing('b'));
    remote.goOnline();

    const result = await repo.flush();

    expect(result).toEqual({ delivered: 2, remaining: 0 });
    expect(remote.contents().map((t) => t.id)).toEqual(['a', 'b']);
    expect(outbox.contents()).toEqual([]);
  });

  it('survives being killed: a fresh repository replays the stored queue', async () => {
    // This is the whole point of the outbox -- the Firestore SDK's in-memory queue cannot.
    const remote = flakyRemote();
    const outbox = fakeOutbox();

    const before = createOfflineRepository(remote.repository, fakeCache(), outbox);
    await before.create(thing('survivor'));

    remote.goOnline();
    const after = createOfflineRepository(remote.repository, fakeCache(), outbox);
    await after.flush();

    expect(remote.contents().map((t) => t.id)).toEqual(['survivor']);
  });

  it('keeps the queue when the network is still down', async () => {
    const outbox = fakeOutbox();
    const repo = createOfflineRepository(flakyRemote().repository, fakeCache(), outbox);

    await repo.create(thing('a'));
    const result = await repo.flush();

    expect(result).toEqual({ delivered: 0, remaining: 1 });
    expect(outbox.contents()).toHaveLength(1);
  });
});

describe('createOfflineRepository — reading', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('flushes before reading, so pending edits are not overwritten', async () => {
    const remote = flakyRemote();
    const cache = fakeCache();
    const repo = createOfflineRepository(remote.repository, cache, fakeOutbox());

    await repo.create(thing('offline-write'));
    remote.goOnline();

    const things = await repo.list();

    // Without the pre-flush, list() would return the server's empty set and replace the
    // mirror, and the write would disappear off the screen before being delivered.
    expect(things.map((t) => t.id)).toEqual(['offline-write']);
    expect(cache.contents().map((t) => t.id)).toEqual(['offline-write']);
  });

  it('serves the mirror when the server is unreachable', async () => {
    const repo = createOfflineRepository(
      flakyRemote().repository,
      fakeCache([thing('cached')]),
      fakeOutbox()
    );

    expect((await repo.list()).map((t) => t.id)).toEqual(['cached']);
  });
});

describe('createOfflineRepository — permanent failures', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  const denied: ThingsRepository = {
    list: async () => {
      throw firestoreError('permission-denied');
    },
    create: async () => {
      throw firestoreError('permission-denied');
    },
    update: async () => {
      throw firestoreError('permission-denied');
    },
    remove: async () => {
      throw firestoreError('permission-denied');
    },
  };

  it('rejects a rejected write instead of queueing it forever', async () => {
    const outbox = fakeOutbox();
    const repo = createOfflineRepository(denied, fakeCache(), outbox);

    await expect(repo.create(thing('a'))).rejects.toMatchObject({ code: 'permission-denied' });
    expect(outbox.contents()).toEqual([]);
  });

  it('drops a poison operation rather than wedging the queue behind it', async () => {
    const outbox = fakeOutbox();
    await outbox.append({ kind: 'create', id: 'bad', thing: thing('bad') });

    const repo = createOfflineRepository(denied, fakeCache(), outbox);
    const result = await repo.flush();

    expect(result).toEqual({ delivered: 1, remaining: 0 });
    expect(outbox.contents()).toEqual([]);
  });

  it('counts a removal of something already gone as delivered', async () => {
    const gone: ThingsRepository = {
      list: async () => [],
      create: async () => {},
      update: async () => {},
      remove: async () => {
        throw firestoreError('not-found');
      },
    };

    const outbox = fakeOutbox();
    await outbox.append({ kind: 'remove', id: 'a' });

    const repo = createOfflineRepository(gone, fakeCache(), outbox);
    expect(await repo.flush()).toEqual({ delivered: 1, remaining: 0 });
  });
});

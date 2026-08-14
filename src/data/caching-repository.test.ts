import type { CacheRepository } from '@/data/async-storage-repository';
import { createCachingRepository } from '@/data/caching-repository';
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
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
  };
}

/** In-memory stand-in for the AsyncStorage-backed cache. */
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

function fakeRemote(initial: Thing[] = []): ThingsRepository & { contents: () => Thing[] } {
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
  };
}

function offlineRemote(): ThingsRepository {
  const fail = async () => {
    throw new Error('network unreachable');
  };
  return { list: fail, create: fail, update: fail, remove: fail };
}

describe('createCachingRepository — online', () => {
  it('returns what the remote has', async () => {
    const repo = createCachingRepository(fakeRemote([thing('a')]), fakeCache());
    expect((await repo.list()).map((t) => t.id)).toEqual(['a']);
  });

  it('mirrors the remote list into the cache on every read', async () => {
    const cache = fakeCache([thing('stale')]);
    const repo = createCachingRepository(fakeRemote([thing('a'), thing('b')]), cache);

    await repo.list();

    // The mirror is replaced wholesale, not merged: a Thing deleted on another device must
    // not survive in the cache and reappear when offline.
    expect(cache.contents().map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('writes reach both the cache and the remote', async () => {
    const cache = fakeCache();
    const remote = fakeRemote();
    const repo = createCachingRepository(remote, cache);

    await repo.create(thing('a'));

    expect(cache.contents().map((t) => t.id)).toEqual(['a']);
    expect(remote.contents().map((t) => t.id)).toEqual(['a']);
  });

  it('propagates updates and removals to both', async () => {
    const cache = fakeCache([thing('a')]);
    const remote = fakeRemote([thing('a')]);
    const repo = createCachingRepository(remote, cache);

    await repo.update('a', { title: 'renamed' });
    expect(cache.contents()[0].title).toBe('renamed');
    expect(remote.contents()[0].title).toBe('renamed');

    await repo.remove('a');
    expect(cache.contents()).toEqual([]);
    expect(remote.contents()).toEqual([]);
  });
});

describe('createCachingRepository — offline', () => {
  // The fallback warns by design. Silenced so that a warning appearing in this suite's output
  // means something actually went wrong.
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('serves the cache when the remote read fails', async () => {
    const repo = createCachingRepository(offlineRemote(), fakeCache([thing('cached')]));
    expect((await repo.list()).map((t) => t.id)).toEqual(['cached']);
  });

  it('does not wipe the cache when the remote read fails', async () => {
    const cache = fakeCache([thing('cached')]);
    const repo = createCachingRepository(offlineRemote(), cache);

    await repo.list();

    expect(cache.contents().map((t) => t.id)).toEqual(['cached']);
  });

  it('keeps a write in the cache even though the remote call throws', async () => {
    // The Thing stays on screen and on disk when signal drops. The write is still lost if the
    // app is killed before reconnecting -- see the module doc comment.
    const cache = fakeCache();
    const repo = createCachingRepository(offlineRemote(), cache);

    await expect(repo.create(thing('a'))).rejects.toThrow('network unreachable');
    expect(cache.contents().map((t) => t.id)).toEqual(['a']);
  });

  it('keeps a removal in the cache even though the remote call throws', async () => {
    const cache = fakeCache([thing('a')]);
    const repo = createCachingRepository(offlineRemote(), cache);

    await expect(repo.remove('a')).rejects.toThrow('network unreachable');
    expect(cache.contents()).toEqual([]);
  });
});

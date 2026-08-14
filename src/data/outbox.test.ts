import { compactOutbox, type OutboxOp } from '@/data/outbox';
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

const create = (id: string, title?: string): OutboxOp => ({
  kind: 'create',
  id,
  thing: thing(id, title),
});
const update = (id: string, patch: Partial<Thing>): OutboxOp => ({ kind: 'update', id, patch });
const remove = (id: string): OutboxOp => ({ kind: 'remove', id });

describe('compactOutbox', () => {
  it('leaves unrelated operations alone', () => {
    const ops = [create('a'), create('b'), remove('c')];
    expect(compactOutbox(ops)).toEqual(ops);
  });

  it('drops a Thing created and deleted before either reached the server', () => {
    // Replaying both would make a document appear and vanish on every other device.
    expect(compactOutbox([create('a'), remove('a')])).toEqual([]);
  });

  it('folds an edit into a pending create', () => {
    const result = compactOutbox([create('a', 'first'), update('a', { title: 'second' })]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'create', id: 'a' });
    expect((result[0] as { thing: Thing }).thing.title).toBe('second');
  });

  it('merges repeated edits to one Thing, later keys winning', () => {
    const result = compactOutbox([
      update('a', { title: 'one' }),
      update('a', { title: 'two' }),
      update('a', { notes: 'hello' }),
    ]);

    expect(result).toEqual([{ kind: 'update', id: 'a', patch: { title: 'two', notes: 'hello' } }]);
  });

  it('keeps only the removal when a synced Thing is edited then deleted', () => {
    expect(compactOutbox([update('a', { title: 'x' }), remove('a')])).toEqual([remove('a')]);
  });

  it('lets a deletion win over a later edit', () => {
    // Deleting then editing is not a thing a user does deliberately; if it happens, what they
    // last asked for was deletion.
    expect(compactOutbox([remove('a'), update('a', { title: 'x' })])).toEqual([remove('a')]);
  });

  it('preserves first-touch order across ids', () => {
    const result = compactOutbox([
      create('a'),
      create('b'),
      update('a', { title: 'edited' }),
      create('c'),
    ]);

    expect(result.map((op) => op.id)).toEqual(['a', 'b', 'c']);
  });

  it('collapses a long offline editing session to one operation', () => {
    const ops: OutboxOp[] = [create('a')];
    for (let i = 0; i < 200; i += 1) ops.push(update('a', { title: `draft ${i}` }));

    const result = compactOutbox(ops);
    expect(result).toHaveLength(1);
    expect((result[0] as { thing: Thing }).thing.title).toBe('draft 199');
  });

  it('handles an empty queue', () => {
    expect(compactOutbox([])).toEqual([]);
  });
});

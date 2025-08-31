import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  computeFieldConflicts,
  resolveKeepLocal,
  resolveKeepServer,
  saveConflict,
  getConflict,
  listConflicts,
  deleteConflict,
  applyResolution,
} from '@/lib/conflict';

// Mock storage layer used by conflict.ts
vi.mock('@/lib/storage', () => {
  const meta = new Map<string, unknown>();
  const exams: unknown[] = [];
  return {
    getMeta: async (key: string) => meta.get(key)?.value ?? meta.get(key),
    setMeta: async (key: string, value: unknown) => meta.set(key, { key, value }),
    listMetaKeys: async (prefix: string) => Array.from(meta.keys()).filter((k) => k.startsWith(prefix)),
    deleteMeta: async (key: string) => meta.delete(key),
    getAllExamsFromDB: async () => exams.slice(),
    saveExamsToDB: async (all: unknown[]) => {
      exams.splice(0, exams.length, ...all);
    },
  };
});

describe('computeFieldConflicts', () => {
  it('detects differing fields between objects', () => {
    const local = { id: '1', name: 'A', date: '2025-01-01', tags: ['x'] };
    const server = { id: '1', name: 'B', date: '2025-01-01', tags: ['x', 'y'] };
    const fields = computeFieldConflicts(local, server);
    expect(fields.sort()).toEqual(['name', 'tags']);
  });
});

describe('resolvers', () => {
  it('keep local returns a deep copy', () => {
    const local = { a: { b: 1 } };
    const resolved = resolveKeepLocal(local);
    expect(resolved).toEqual(local);
    expect(resolved).not.toBe(local); // cloned
  });
  it('keep server returns a deep copy', () => {
    const server = { a: { b: 2 } };
    const resolved = resolveKeepServer(server);
    expect(resolved).toEqual(server);
    expect(resolved).not.toBe(server); // cloned
  });
});

describe('conflict persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves, lists, fetches and deletes conflicts', async () => {
    await saveConflict('exams', 'e1', { id: 'e1', name: 'L' }, { id: 'e1', name: 'S' }, ['name']);
    await saveConflict('exams', 'e2', { id: 'e2', name: 'L2' }, { id: 'e2', name: 'S2' }, ['name']);

    const list = await listConflicts('exams');
    expect(list.length).toBe(2);

    const one = await getConflict('exams', 'e1');
    expect(one?.id).toBe('e1');

    await deleteConflict('exams', 'e1');
    const after = await listConflicts('exams');
    expect(after.map((c) => c.id).sort()).toEqual(['e2']);
  });
});

describe('applyResolution', () => {
  it('applies resolution to exams store with upsert semantics', async () => {
    // create conflict; then resolve
    const resolved = { id: 'e3', name: 'Final', date: '2025-01-01', deckIds: [], questionBankIds: [], tags: [], tagFilterType: 'any', filterMode: 'all' };
    await applyResolution('exams', 'e3', resolved);

    // storage mock keeps an array; re-import mock to fetch
    const { getAllExamsFromDB } = await import('@/lib/storage');
    const all = await getAllExamsFromDB();
    expect(all.find((e: unknown) => (e as { id: string }).id === 'e3')).toEqual(resolved);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { McqData } from '@/data/questionBanks';

import {
  getAIExplanation,
  saveAIExplanation,
  generateAIExplanation,
  deleteAIExplanation,
  clearExplanationCache,
  getExplanationCacheSize,
  AI_EXPLANATIONS_STORE,
  type AIExplanation,
} from '../ai-explanation';

// In-memory mock table implementation
class InMemoryTable<T> {
  store = new Map<string, T>();

  async get(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }
  async put(value: T, key: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Shared mock state per test
interface TableItem {
  mcqId: string;
  [key: string]: unknown;
}

interface MockTableSpy {
  put: ReturnType<typeof vi.fn>;
}

let mockTables: Record<string, InMemoryTable<TableItem>> = {};
const tableSpy: MockTableSpy = {
  put: vi.fn().mockImplementation(async (): Promise<void> => {
    // Mock implementation that does nothing
  }),
};

vi.mock('@/lib/storage', () => {
  return {
    // table<T>(name) returns an InMemoryTable instance keyed by name
    table: async <T extends { mcqId: string }>(name: string) => {
      if (!mockTables[name]) {
        mockTables[name] = new InMemoryTable<T>();
      }
      const tbl = mockTables[name] as InMemoryTable<T>;

      // Wrap to spy on put calls when using AI_EXPLANATIONS_STORE
      if (name === AI_EXPLANATIONS_STORE) {
        return {
          get: (key: string) => tbl.get(key),
          put: async (value: T, key: string): Promise<void> => {
            await tableSpy.put(value, key);
            return tbl.put(value, key);
          },
          delete: (key: string): Promise<void> => tbl.delete(key),
        };
      }
      return tbl;
    },
  };
});

vi.mock('@/lib/broadcast', () => ({
  postMessage: vi.fn().mockImplementation(() => Promise.resolve()),
}));

// Minimal MCQ fixture
const mcqFixture = {
  id: 'mcq-1',
  question: 'What is 2 + 2?',
  explanation: 'Because 2 added to 2 equals 4.',
  options: [
    { id: 'o1', text: '3', isCorrect: false },
    { id: 'o2', text: '4', isCorrect: true },
    { id: 'o3', text: '5', isCorrect: false },
  ],
} as const;

describe('ai-explanation service', () => {
  beforeEach(() => {
    mockTables = {};
    tableSpy.put.mockClear();
    clearExplanationCache();
  });

  it('returns null when no explanation exists', async () => {
    const res = await getAIExplanation(mcqFixture.id);
    expect(res).toBeNull();
    expect(getExplanationCacheSize()).toBe(0);
  });

  it('generates and saves a new explanation, then caches it', async () => {
    const mcqData = {
      ...mcqFixture,
      options: mcqFixture.options.map((opt) => ({
        ...opt,
        isCorrect: opt.id === 'o2', // Make sure only one option is correct
      })),
    };
    const exp = await generateAIExplanation(mcqData);

    expect(exp).toBeTruthy();
    expect(exp.mcqId).toBe(mcqFixture.id);
    expect(typeof exp.explanation).toBe('string');
    expect(Array.isArray(exp.keyPoints)).toBe(true);

    // put was called once on first generation
    expect(tableSpy.put).toHaveBeenCalledTimes(1);

    // cache should have the item
    expect(getExplanationCacheSize()).toBe(1);

    // calling generate again should use cache/storage and not write again
    const exp2 = await generateAIExplanation(mcqData);
    expect(exp2.id).toBe(exp.id);
    expect(tableSpy.put).toHaveBeenCalledTimes(1);
  });

  it('saveAIExplanation writes to storage and updates cache', async () => {
    const payload: AIExplanation = {
      id: 'ai-exp-mcq-1',
      mcqId: mcqFixture.id,
      explanation: 'Custom explanation',
      reasoning: 'Custom reasoning',
      keyPoints: ['A', 'B'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveAIExplanation(payload);
    expect(tableSpy.put).toHaveBeenCalledTimes(1);

    const fetched = await getAIExplanation(mcqFixture.id);
    expect(fetched?.explanation).toBe('Custom explanation');
    expect(getExplanationCacheSize()).toBe(1);
  });

  it('deleteAIExplanation removes from storage and cache', async () => {
    // Prime with generated explanation
    expect(getExplanationCacheSize()).toBe(1);

    await deleteAIExplanation(mcqFixture.id);

    // Now get should return null and cache empty
    const after = await getAIExplanation(mcqFixture.id);
    expect(after).toBeNull();
    expect(getExplanationCacheSize()).toBe(0);
  });

  it('clearExplanationCache empties the in-memory cache without touching storage', async () => {
    await generateAIExplanation(mcqFixture as unknown as McqData);
    expect(getExplanationCacheSize()).toBe(1);

    clearExplanationCache();
    expect(getExplanationCacheSize()).toBe(0);

    // Fetching again should repopulate from mocked storage (no extra put)
    const fetched = await getAIExplanation(mcqFixture.id);
    expect(fetched).toBeTruthy();
    expect(getExplanationCacheSize()).toBe(1);
  });
});

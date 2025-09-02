// Dexie adapter for Prepigo (opt-in via VITE_USE_DEXIE)
// Mirrors the API of src/lib/idb.ts so migration can be toggled via env.

import type { BroadcastEvent } from './broadcast';
import { postMessage } from '@/lib/broadcast';
import type { DeckData } from '@/data/decks';
import type { ExamData } from '@/data/exams';
import type { QuestionBankData } from '@/data/questionBanks';

// Type for the transaction function to avoid using 'any'
type TransactionFunction = <T>(
  mode: 'rw' | 'r',
  tables: string[],
  callback: (tx: { table: <T>(name: string) => Table<T> }) => Promise<T>,
) => Promise<T>;

// Type-safe transaction helper
async function withTransaction<T>(
  storeNames: string[],
  mode: 'rw' | 'r',
  operation: (tx: { table: <T>(name: string) => Table<T> }) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  const dexieDb = db as unknown as { transaction?: TransactionFunction };
  if (typeof dexieDb.transaction !== 'function') {
    throw new Error('Database transaction method is unavailable (DB not initialized)');
  }

  // IMPORTANT: call as a method to preserve `this` binding inside Dexie
  return dexieDb.transaction(mode, storeNames, operation);
}

import {
  ResourceItemDbSchema,
  ResourceHighlightSchema,
  validate,
  type ResourceItem as ZResourceItem,
  type ResourceHighlight as ZResourceHighlight,
} from '@/lib/schemas';

// Lightweight metrics for DB ops (enabled when DEBUG flag is on)
function withDbMetrics<T>(name: string, fn: () => Promise<T>): Promise<T> {
  // DEBUG_DB is defined elsewhere in this file
  const enabled = typeof DEBUG_DB !== 'undefined' && !!DEBUG_DB;
  if (!enabled) return fn();
  const start =
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  return fn()
    .then((res) => {
      const end =
        typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const dur = end - start;
      if (dur > 100) console.warn(`[DB][slow] ${name}: ${dur.toFixed(1)}ms`);
      return res;
    })
    .catch((err) => {
      console.error(`[DB][error] ${name}:`, err);
      throw err;
    });
}

// Debounced broadcast for storage writes (backward compatible single-event)
type StorageWriteEvent = {
  resource: string;
  id?: string;
  clear?: boolean;
};
const _pendingWrites: StorageWriteEvent[] = [];
let _writeTimer: ReturnType<typeof setTimeout> | null = null;
function broadcastStorageWrite(ev: StorageWriteEvent) {
  _pendingWrites.push(ev);
  if (_writeTimer) return;
  _writeTimer = setTimeout(() => {
    const batch = _pendingWrites.splice(0);
    _writeTimer = null;
    for (const it of batch) {
      try {
        postMessage({ type: 'storage-write', resource: it.resource, id: it.id });
      } catch {
        /* noop */
      }
    }
  }, 50);
}

// Extended Window interface with Web Locks API
declare global {
  interface Navigator {
    locks?: {
      request<T>(
        name: string,
        options: { mode: 'exclusive' | 'shared' },
        callback: () => Promise<T> | T,
      ): Promise<T>;
    };
  }
}

// Safe variant that can recover when a highlight ID cannot be found in v2.
// Strategy:
// 1) Try v2 by id
// 2) If not found, fall back to v1 by resourceId and link the most recent highlight
export async function linkHighlightToCardSafe(
  resourceId: string,
  id: string,
  cardId: string,
): Promise<void> {
  // Try v2 first
  try {
    const t2 = await table<ResourceHighlight>(RESOURCE_HIGHLIGHTS_V2_STORE);
    const h2 = await t2.get(id);
    if (h2) {
      const updated: ResourceHighlight = { ...h2, linkedCardId: cardId, updatedAt: Date.now() };
      await t2.put(updated, id);
      broadcastStorageWrite({ resource: RESOURCE_HIGHLIGHTS_V2_STORE });
      return;
    }
  } catch {
    // ignore and try v1
  }

  // Fallback to v1: choose the most recent highlight for this resource and link it
  try {
    const t1 = await table<ResourceHighlight>(RESOURCE_HIGHLIGHTS_STORE);
    const list = await t1.where('resourceId').equals(resourceId).toArray();
    if (list && list.length) {
      const latest = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      // Use update to avoid strict typing on key differences between v1/v2
      await (t1 as any).update((latest as any).id, {
        linkedCardId: cardId,
        updatedAt: Date.now(),
      });
      broadcastStorageWrite({ resource: RESOURCE_HIGHLIGHTS_STORE });
      return;
    }
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    await notifyDbError('linkHighlightToCardSafe', error);
    throw error;
  }

  const err = new Error(`No highlight found to link for resource ${resourceId}`);
  await notifyDbError('linkHighlightToCardSafe', err);
  throw err;
}

// Optional cooperative lock to serialize critical sections across tabs (best-effort)
async function runWithLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) return fn();
  return locks.request(`prepigo:${name}`, { mode: 'exclusive' }, fn);
}

// Resource-scoped lock to narrow contention windows
async function withResourceLock<T>(
  resourceId: string,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const locks = globalThis.navigator?.locks;
  const lockName = `prepigo:resource:${resourceId}:${name}`;
  if (!locks?.request) return fn();
  return locks.request(lockName, { mode: 'exclusive' }, fn);
}

// Lightweight typed adapters around Dexie tables/collections we use
type DexieTable<T> = {
  get: (key: string) => Promise<T | undefined>;
  put: (value: T, key?: string) => Promise<unknown>;
  add: (value: T) => Promise<unknown>;
  clear: () => Promise<unknown>;
  bulkPut: (values: T[]) => Promise<unknown>;
  bulkDelete: (keys: (number | string)[]) => Promise<unknown>;
  where: (key: keyof T & string) => {
    equals: (value: unknown) => {
      toArray: () => Promise<T[]>;
      delete?: () => Promise<void>;
    };
    anyOf: (values: (number | string)[]) => {
      modify: (callback: (record: T) => void) => Promise<unknown>;
      toArray?: () => Promise<T[]>;
    };
  };
  orderBy: (key: keyof T & string) => {
    limit: (limit: number) => { toArray: () => Promise<T[]> };
    reverse: () => { toArray: () => Promise<T[]> };
  };
  toArray: () => Promise<T[]>;
  delete: (key: unknown) => Promise<unknown>;
};

function asTable<T>(t: unknown): DexieTable<T> {
  return t as DexieTable<T>;
}

// ----- Local record types used in this module -----
type MediaRecord = {
  id: string;
  blob?: ArrayBuffer;
  type?: string;
  lastAccess?: number;
};

type SyncOperationInternal = {
  id?: string | number;
  resource?: string;
  opType?: string;
  createdAt: number;
  nextAttemptAt?: number;
  priority?: number;
};

// ----- Shims over the underlying Dexie db to avoid any -----
export async function table<T = unknown>(name: string): Promise<Table<T>> {
  const db = await getDb();
  // Structural cast into our minimal Table<T> contract
  return db.table<T>(name) as unknown as Table<T>;
}

async function setMeta<T = unknown>(key: string, value: T): Promise<void> {
  const t = await table<{ key: string; value: T }>(META_STORE);
  await t.put({ key, value }, key);
}

// Public meta helpers for app logic (e.g., one-time seeds)
export async function getMetaValue<T = unknown>(key: string): Promise<T | undefined> {
  const t = await table<{ key: string; value?: T }>(META_STORE);
  const rec = await t.get(key);
  return rec?.value as T | undefined;
}

export async function setMetaValue<T = unknown>(key: string, value: T): Promise<void> {
  await setMeta<T>(key, value);
}

// Validators (Zod)
function assertResourceItem(x: unknown): asserts x is ZResourceItem {
  validate(ResourceItemDbSchema, x, 'ResourceItem');
}

// Media usage helpers
async function estimateMediaBytes(): Promise<number> {
  try {
    const mediaTable = await table<MediaRecord>(MEDIA_STORE);
    const media = await mediaTable.toArray();
    return media.reduce<number>((sum: number, record: MediaRecord) => {
      const blobSize = record.blob?.byteLength ?? 0;
      return sum + blobSize;
    }, 0);
  } catch {
    return 0;
  }
}
async function ensureMediaQuotaWillFit(additionalBytes: number) {
  const used = await estimateMediaBytes();
  if (used + additionalBytes > MAX_MEDIA_TOTAL_BYTES) {
    throw new Error('Media storage quota would be exceeded');
  }
}

// ---- Configuration & Utilities ----
const MAX_MEDIA_BYTES = (() => {
  try {
    const v = importMeta.env?.VITE_MAX_MEDIA_BYTES;
    return v ? Number(v) : 50 * 1024 * 1024; // default 50MB
  } catch {
    return 50 * 1024 * 1024;
  }
})();
const MAX_MEDIA_TOTAL_BYTES = (() => {
  try {
    const v = importMeta.env?.VITE_MAX_MEDIA_TOTAL_MB;
    return v ? Number(v) * 1024 * 1024 : 500 * 1024 * 1024; // default 500MB
  } catch {
    return 500 * 1024 * 1024;
  }
})();

async function notifyDbError(context: string, error: unknown) {
  console.error(`[DB][notify] ${context}:`, error);
  // Broadcast minimal payload matching BroadcastEvent type
  try {
    const event: BroadcastEvent = { type: 'sync-error', attempt: 0, delay: 0 };
    postMessage(event);
  } catch {
    /* noop */
  }
  // Persist last error (best-effort; ignore failures)
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await setMeta('lastDbError', {
      at: Date.now(),
      context,
      message: errorMessage,
    });
  } catch {
    /* noop */
  }
}

type RunDbOptions = { swallow?: boolean };

async function runDbOp<T>(
  name: string,
  fn: () => Promise<T>,
  opts?: RunDbOptions,
): Promise<T | undefined> {
  try {
    return await withDbMetrics(name, fn);
  } catch (e) {
    await notifyDbError(name, e);
    if (opts?.swallow) {
      return undefined;
    }
    throw e;
  }
}

// Store names (must match src/lib/idb.ts)
export const DECKS_STORE = 'decks';
export const REVIEW_LOGS_STORE = 'review_logs';
export const MEDIA_STORE = 'media';
export const SESSION_STATE_STORE = 'session_state';
export const QUESTION_BANKS_STORE = 'question_banks';
export const MCQ_REVIEW_LOGS_STORE = 'mcq_review_logs';
export const EXAMS_STORE = 'exams';
export const EXAM_LOGS_STORE = 'exam_logs';
export const SYNC_QUEUE_STORE = 'syncQueue';
export const META_STORE = 'meta';
export const RESOURCES_STORE = 'resources';
export const RESOURCE_HIGHLIGHTS_STORE = 'resource_highlights';
export const RESOURCE_HIGHLIGHTS_V2_STORE = 'resource_highlights_v2';

// Base table interface with common operations
type Table<T = unknown> = {
  get: (key: string) => Promise<T | undefined>;
  put: (value: T, key?: string) => Promise<unknown>;
  add: (value: T) => Promise<unknown>;
  clear: () => Promise<unknown>;
  bulkPut: (values: T[]) => Promise<unknown>;
  bulkDelete: (keys: (number | string)[]) => Promise<unknown>;
  where: (key: string) => {
    equals: (value: unknown) => {
      toArray: () => Promise<T[]>;
      delete: () => Promise<unknown>;
    };
    anyOf: (values: (number | string)[]) => {
      modify: (callback: (record: T) => void) => Promise<unknown>;
      toArray: () => Promise<T[]>;
    };
  };
  orderBy: (key: string) => {
    limit: (limit: number) => {
      toArray: () => Promise<T[]>;
    };
    reverse: () => {
      toArray: () => Promise<T[]>;
    };
  };
  toArray: () => Promise<T[]>;
  delete: (key: string | number) => Promise<unknown>;
};

// Database instance with typed tables
interface DbInstance {
  // Core methods
  table<T = unknown>(name: string): Table<T>;
  close: () => void;
  open: () => Promise<void>;

  // Transaction support
  transaction: <T>(mode: 'rw' | 'r', tables: string[], callback: () => Promise<T>) => Promise<T>;
}

let _db: DbInstance | null = null;

// Type-safe environment variable access
interface ImportMetaEnv {
  VITE_DEBUG_DB?: string;
  VITE_USE_DEXIE?: string;
  VITE_MAX_MEDIA_BYTES?: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  env: ImportMetaEnv;
}

declare const importMeta: ImportMeta;

const DEBUG_DB =
  typeof importMeta !== 'undefined' && importMeta.env && importMeta.env.VITE_DEBUG_DB === 'true';

const DB_NAME = 'PrepigoDB';
// Schema version history:
// - v11: Introduced resources store
// - v12: Introduced resource_highlights store (non-destructive)
// - v13: Introduced resource_highlights_v2 with string PK 'id' and createdAt index; migration from v1
const DB_VERSION = 13;

// Schema definitions for each version
const SCHEMA_VERSIONS = {
  1: {
    decks: 'id',
  },
  2: {
    review_logs: '++id, cardId',
    decks: 'id',
  },
  3: {
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  4: {
    session_state: '', // key-value
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  5: {
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  6: {
    mcq_review_logs: '++id, mcqId',
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  7: {
    exams: 'id',
    mcq_review_logs: '++id, mcqId',
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  8: {
    exam_logs: '++id, examId',
    exams: 'id',
    mcq_review_logs: '++id, mcqId',
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  9: {
    syncQueue: '++id, resource, opType, createdAt',
    exam_logs: '++id, examId',
    exams: 'id',
    mcq_review_logs: '++id, mcqId',
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  10: {
    meta: 'key',
    syncQueue: '++id, resource, opType, createdAt',
    exam_logs: '++id, examId',
    exams: 'id',
    mcq_review_logs: '++id, mcqId',
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  11: {
    resources: 'id',
    meta: 'key',
    syncQueue: '++id, resource, opType, createdAt',
    exam_logs: '++id, examId',
    exams: 'id',
    mcq_review_logs: '++id, mcqId',
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  12: {
    resource_highlights: '++id, resourceId',
    resources: 'id, createdAt',
    meta: 'key',
    syncQueue: '++id, resource, opType, createdAt',
    exam_logs: '++id, examId',
    exams: 'id',
    mcq_review_logs: '++id, mcqId',
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
  13: {
    // New store with string primary key for highlights; keep old store for backward reads
    resource_highlights_v2: 'id, resourceId, createdAt',
    resources: 'id, createdAt',
    meta: 'key',
    syncQueue: '++id, resource, opType, createdAt',
    exam_logs: '++id, examId',
    exams: 'id',
    mcq_review_logs: '++id, mcqId',
    question_banks: 'id',
    session_state: '',
    media: 'id',
    review_logs: '++id, cardId',
    decks: 'id',
  },
} as const;

// Public types
export interface ExamLog {
  id: string;
  examId: string;
  userId: string;
  answers: Record<string, string>;
  score?: number;
  totalQuestions: number;
  completed: boolean;
  startedAt: number;
  submittedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type McqReviewLog = {
  mcqId: string;
  rating: number; // ts-fsrs Rating enum value
  state: number; // ts-fsrs State enum value
  due: string; // ISO date
  stability: number;
  difficulty: number; // 1-10
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  review: string; // ISO date
  duration?: number; // ms, optional
};

async function getDb(): Promise<DbInstance> {
  if (_db) {
    console.log('Returning cached database instance');
    return _db;
  }

  if (DEBUG_DB) console.log('Initializing Dexie database...');
  const { Dexie } = await import('dexie');

  const buildDb = () => {
    if (DEBUG_DB) console.log(`Building database schema up to version ${DB_VERSION}`);
    const db = new Dexie(DB_NAME);

    // Apply schema versions
    for (let i = 1; i <= Math.min(DB_VERSION, 12); i++) {
      const schema = SCHEMA_VERSIONS[i as keyof typeof SCHEMA_VERSIONS];
      if (DEBUG_DB)
        console.log(`  Version ${i}:`, schema ? 'Applying schema' : 'No schema changes');
      if (schema) {
        try {
          db.version(i).stores(schema);
        } catch (schemaError) {
          console.error(`Error applying schema version ${i}:`, schemaError);
          throw schemaError;
        }
      }
    }

    // v13: add resource_highlights_v2 and migrate data from v1 (numeric ++id) to v2 (string id)
    try {
      const v13schema = SCHEMA_VERSIONS[13 as keyof typeof SCHEMA_VERSIONS] as
        | Record<string, string>
        | undefined;
      if (v13schema) {
        db.version(13)
          .stores(v13schema)
          .upgrade(async (tx) => {
            try {
              // Type assertion for transaction object
              const typedTx = tx as unknown as {
                db: { tables: Array<{ name: string }> };
                table: (name: string) => Table<unknown> | undefined;
                [key: string]: Table<unknown> | unknown;
              };

              const tables = typedTx.db.tables?.map((t) => t.name) ?? [];
              const hasV1 = tables.includes(RESOURCE_HIGHLIGHTS_STORE);
              const v1 =
                typedTx.table?.(RESOURCE_HIGHLIGHTS_STORE) ??
                (typedTx[RESOURCE_HIGHLIGHTS_STORE] as Table<unknown> | undefined);
              const v2 =
                typedTx.table?.(RESOURCE_HIGHLIGHTS_V2_STORE) ??
                (typedTx[RESOURCE_HIGHLIGHTS_V2_STORE] as Table<unknown> | undefined);

              if (hasV1 && v1 && v2) {
                const already = await v2.toArray();
                if (!already?.length) {
                  const all: unknown[] = await v1.toArray();
                  const errors: Array<{ id: string; error: string }> = [];

                  for (const h of all) {
                    if (!h || typeof h !== 'object' || !('id' in h)) continue;

                    const highlight = h as Record<string, unknown>;
                    const stringId =
                      typeof highlight.id === 'string'
                        ? highlight.id
                        : String(highlight.id ?? crypto.randomUUID?.() ?? `hl-${Date.now()}`);

                    const rec = { ...highlight, id: stringId };

                    try {
                      // Validate with v2 schema before writing
                      validate(
                        ResourceHighlightSchema,
                        rec as ZResourceHighlight,
                        'ResourceHighlight',
                      );
                      await v2.put(rec);
                    } catch (ve) {
                      const error = ve instanceof Error ? ve.message : String(ve);
                      errors.push({ id: stringId, error });
                    }
                  }

                  if (errors.length) {
                    const meta =
                      typedTx.table?.(META_STORE) ??
                      (typedTx[META_STORE] as Table<{ key: string; value: unknown }> | undefined);
                    const key = `migration:errors:${Date.now()}`;
                    await meta?.put?.({
                      key,
                      value: {
                        store: RESOURCE_HIGHLIGHTS_V2_STORE,
                        count: errors.length,
                        items: errors.slice(0, 50),
                      },
                    });
                  }
                }

                // Mark migration as complete
                const meta =
                  typedTx.table?.(META_STORE) ??
                  (typedTx[META_STORE] as Table<{ key: string; value: unknown }> | undefined);
                await meta?.put?.({
                  key: 'migration:resource_highlights_v2',
                  value: true,
                });
              }
            } catch (mErr) {
              console.warn('[Dexie] v13 migration warning:', mErr);
            }
          });
      }
    } catch (e) {
      console.warn('[Dexie] Failed setting up v13 migration', e);
    }

    return db;
  };

  const db = buildDb();
  try {
    if (DEBUG_DB) console.log('Opening database...');
    // Attach multi-tab handlers before opening
    const dexieLike = db as {
      on?: (event: 'blocked' | 'versionchange', cb: () => void) => void;
      close: () => void;
    };
    dexieLike.on?.('blocked', () => {
      console.warn('[Dexie] Upgrade blocked by another tab. Please close other tabs to continue.');
    });
    dexieLike.on?.('versionchange', () => {
      try {
        dexieLike.close();
      } catch {
        /* noop */
      }
      console.warn('[Dexie] Database version change detected; connection closed to allow upgrade.');
    });

    await db.open();
    if (DEBUG_DB) console.log('Database opened successfully');
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.error('Database open error:', e);
    // Do NOT auto-delete DB; surface a clear error for the UI to handle.
    throw new Error(
      `Database error. If you have multiple tabs open, close others and retry. Details: ${msg}`,
    );
  }

  _db = db as unknown as DbInstance;
  return _db;
}

export async function clearMediaDB() {
  const t = await table(MEDIA_STORE);
  await t.clear();
}

// ...

export async function takeSyncBatch(limit = 20) {
  const t = await table(SYNC_QUEUE_STORE);
  const now = Date.now();
  const list = (await t
    .orderBy('createdAt')
    .limit(limit * 5)
    .toArray()) as Array<SyncOperationInternal>;
  // Sort by priority desc, then createdAt asc; filter by readiness; cap
  return list
    .filter((op) => (op.nextAttemptAt ?? 0) <= now)
    .sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1) || a.createdAt - b.createdAt)
    .slice(0, limit) as SyncOperationInternal[];
}

// ...

// Paginated resources (mobile-friendly). Returns { items, total }.
export async function getResourcesPage(
  page: number,
  pageSize: number,
): Promise<{ items: ResourceItem[]; total: number }> {
  if (page < 0 || pageSize <= 0) throw new Error('Invalid pagination');
  const t = await table(RESOURCES_STORE);
  try {
    const total = (await t.toArray()).length; // Dexie lacks count() on our typed shim; use simple length to avoid adding more anys
    const items = await (
      t as unknown as {
        orderBy: (key: string) => {
          reverse: () => {
            offset: (n: number) => {
              limit: (n: number) => { toArray: () => Promise<ResourceItem[]> };
            };
          };
        };
      }
    )
      .orderBy('createdAt')
      .reverse()
      .offset(page * pageSize)
      .limit(pageSize)
      .toArray();
    return { items: items as ResourceItem[], total };
  } catch {
    // Fallback without indices
    const all = (await t.toArray()) as ResourceItem[];
    const sorted = all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const start = page * pageSize;
    return { items: sorted.slice(start, start + pageSize), total: sorted.length };
  }
}

interface LastDbError {
  at: number;
  context: string;
  message: string;
}

interface MetaRecord {
  value?: LastDbError;
}

export async function getLastDbError(): Promise<LastDbError | undefined> {
  const t = await table<MetaRecord>(META_STORE);
  const rec = await t.get('lastDbError');
  return rec?.value;
}

// Persisted resource reading progress
export type ResourceProgress = {
  resourceId: string;
  page: number;
  pageCount?: number;
  updatedAt: number;
};

const progressKey = (id: string) => `resourceProgress:${id}`;

export async function setResourceProgress(
  resourceId: string,
  page: number,
  pageCount?: number,
): Promise<void> {
  await runDbOp('setResourceProgress', async () => {
    const t = await table<{ key: string; value: ResourceProgress }>(META_STORE);
    const value: ResourceProgress = { resourceId, page, pageCount, updatedAt: Date.now() };
    await t.put({ key: progressKey(resourceId), value }, progressKey(resourceId));
  });
}

export async function getResourceProgress(
  resourceId: string,
): Promise<{ page: number; pageCount?: number } | undefined> {
  return runDbOp(
    'getResourceProgress',
    async () => {
      const t = await table<{ key: string; value: ResourceProgress }>(META_STORE);
      const rec = await t.get(progressKey(resourceId));
      if (!rec?.value) return undefined;
      const { page, pageCount } = rec.value;
      return { page, pageCount };
    },
    { swallow: true },
  );
}

// ============ Resources (v11+) ============
export type ResourceItem = {
  id: string; // uuid
  title: string;
  description?: string;
  tags?: string[];
  mediaId: string; // references MEDIA_STORE id
  size?: number; // bytes
  type: 'application/pdf';
  createdAt: number;
  updatedAt: number;
};

export async function saveResource(resource: ResourceItem) {
  await runDbOp('saveResource', async () =>
    withResourceLock(resource.id, 'saveResource', async () => {
      assertResourceItem(resource);
      const t = asTable<ResourceItem>(await table(RESOURCES_STORE));
      await t.put(resource);
      broadcastStorageWrite({ resource: RESOURCES_STORE, id: resource.id });
    }),
  );
}

export async function saveResourceWithMedia(resource: ResourceItem, file: Blob) {
  await runDbOp('saveResourceWithMedia', async () =>
    withResourceLock(resource.id, 'saveResourceWithMedia', async () => {
      if (!resource?.id || !resource?.mediaId)
        throw new Error('Invalid resource: missing id/mediaId');
      if (file.size > MAX_MEDIA_BYTES)
        throw new Error(`Media exceeds limit (${file.size} > ${MAX_MEDIA_BYTES})`);
      if (file.type !== 'application/pdf') throw new Error(`Unsupported media type: ${file.type}`);
      await ensureMediaQuotaWillFit(file.size);
      const arrayBuffer = await file.arrayBuffer();

      await withTransaction([MEDIA_STORE, RESOURCES_STORE], 'rw', async (tx) => {
        const mediaT = tx.table<MediaRecord>(MEDIA_STORE);
        const resT = tx.table<ResourceItem>(RESOURCES_STORE);

        await Promise.all([
          mediaT.put({
            id: resource.mediaId,
            blob: arrayBuffer,
            type: file.type,
          }),
          resT.put(resource),
        ]);
      });
      broadcastStorageWrite({ resource: RESOURCES_STORE, id: resource.id });
    }),
  );
}

export async function getAllResourcesFromDB(): Promise<ResourceItem[]> {
  try {
    if (DEBUG_DB) console.log('Getting all resources from DB...');
    const t = await table(RESOURCES_STORE);
    if (DEBUG_DB) console.log('Table access successful, querying resources...');

    try {
      // Try with the indexed query first
      const resources = (await t.orderBy('createdAt').reverse().toArray()) as ResourceItem[];
      console.log(`Successfully retrieved ${resources.length} resources`);
      return resources;
    } catch (queryError) {
      if (DEBUG_DB)
        console.warn(
          'Error querying with createdAt index, falling back to client-side sort:',
          queryError,
        );
      // Fallback to client-side sort if the index isn't available yet
      const allResources = (await t.toArray()) as ResourceItem[];
      return allResources.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  } catch (error) {
    console.error('Error in getAllResourcesFromDB:', error);
    // Surface error; do not delete database automatically
    throw error;
  }
}

export async function deleteResource(id: string) {
  await runDbOp('deleteResource', async () => {
    const t = asTable<ResourceItem>(await table(RESOURCES_STORE));
    await t.delete(id);
    broadcastStorageWrite({ resource: RESOURCES_STORE, id });
  });
}

// Transactional delete: remove resource, media, and both v1/v2 highlights
export async function deleteResourceAndMedia(id: string) {
  await runDbOp('deleteResourceAndMedia', async () =>
    withResourceLock(id, 'deleteResourceAndMedia', async () => {
      await withTransaction(
        [RESOURCES_STORE, MEDIA_STORE, RESOURCE_HIGHLIGHTS_V2_STORE, RESOURCE_HIGHLIGHTS_STORE],
        'rw',
        async (tx) => {
          const resT = tx.table<ResourceItem>(RESOURCES_STORE);
          const mediaT = tx.table<MediaRecord>(MEDIA_STORE);
          const hlV2T = tx.table<ZResourceHighlight>(RESOURCE_HIGHLIGHTS_V2_STORE);
          const hlV1T = tx.table<ZResourceHighlight>(RESOURCE_HIGHLIGHTS_STORE);

          const resource = await resT.get(id);
          if (!resource) return;

          // Delete resource and its media
          await Promise.all([
            resT.delete(id),
            mediaT.delete(resource.mediaId),
            // Delete v2 highlights
            hlV2T.where('resourceId').equals(id).delete(),
            // Delete v1 highlights
            hlV1T.where('resourceId').equals(id).delete(),
          ]);
        },
      );

      // Notify about the deletion
      broadcastStorageWrite({ resource: RESOURCES_STORE, id });
    }),
  );
}

export async function getResourceById(id: string): Promise<ResourceItem | undefined> {
  const t = asTable<ResourceItem>(await table(RESOURCES_STORE));
  return t.get(id);
}

export async function getResourceBlob(resource: ResourceItem) {
  return getMediaFromDB(resource.mediaId);
}

// ----- Media helpers -----

// ============ Resource Highlights (v12+) =========
export interface ResourceHighlight {
  id: string;
  resourceId: string;
  page: number;
  rects: Array<{ x: number; y: number; w: number; h: number; page: number }>;
  text?: string;
  createdAt: number;
  updatedAt?: number;
  linkedCardId?: string;
  color?: 'yellow' | 'green' | 'blue' | 'pink';
  note?: string;
}

export async function saveResourceHighlight(highlight: ResourceHighlight) {
  // Prefer v2 store
  await runDbOp('saveResourceHighlight', async () =>
    withResourceLock(highlight.resourceId, 'saveResourceHighlight', async () => {
      try {
        const t2 = await table(RESOURCE_HIGHLIGHTS_V2_STORE);
        validate(ResourceHighlightSchema, highlight as ZResourceHighlight, 'ResourceHighlight');
        await t2.put(highlight);
        broadcastStorageWrite({ resource: RESOURCE_HIGHLIGHTS_V2_STORE, id: highlight.id });
      } catch {
        // Fallback to v1 for older DBs (will be migrated later)
        const t1 = await table(RESOURCE_HIGHLIGHTS_STORE);
        await t1.put(highlight as unknown as { id?: number });
        broadcastStorageWrite({ resource: RESOURCE_HIGHLIGHTS_STORE });
      }
    }),
  );
}

export async function getHighlightsForResource(resourceId: string): Promise<ResourceHighlight[]> {
  try {
    const t2 = asTable<ResourceHighlight>(await table(RESOURCE_HIGHLIGHTS_V2_STORE));
    const list = await t2.where('resourceId').equals(resourceId).toArray();
    if (list?.length) return list;
  } catch {
    /* noop */
  }
  // Fallback to v1
  try {
    const t1 = asTable<{ id: number; resourceId: string }>(await table(RESOURCE_HIGHLIGHTS_STORE));
    const list1 = await t1.where('resourceId').equals(resourceId).toArray();
    return (list1 as unknown as Array<Record<string, unknown>>).map((h) => ({
      ...(h as Record<string, unknown>),
      id: String((h as { id: number }).id),
    })) as ResourceHighlight[];
  } catch {
    return [];
  }
}

export async function deleteResourceHighlight(id: string) {
  await runDbOp('deleteResourceHighlight', async () =>
    runWithLock('deleteResourceHighlight', async () => {
      try {
        const t2 = await table(RESOURCE_HIGHLIGHTS_V2_STORE);
        await t2.delete(id);
        broadcastStorageWrite({ resource: RESOURCE_HIGHLIGHTS_V2_STORE, id });
        return;
      } catch {
        /* noop */
      }
      try {
        const t1 = await table(RESOURCE_HIGHLIGHTS_STORE);
        await t1.delete(id as unknown as number);
        broadcastStorageWrite({ resource: RESOURCE_HIGHLIGHTS_STORE });
      } catch {
        /* noop */
      }
    }),
  );
}

// Quick DB health check to validate table access across the DB
export async function checkDatabaseHealth(_mode: 'quick' | 'deep' = 'quick') {
  try {
    // Simple table access to verify DB health
    const t = await table(META_STORE);
    await t.toArray();

    // If we got here, the database is accessible
    return { healthy: true as const };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      healthy: false as const,
      error: errorMessage,
    };
  }
}
export async function verifyV13Migration(): Promise<{ ok: boolean; details?: string }> {
  try {
    const v2Table = await table<ResourceHighlight>(RESOURCE_HIGHLIGHTS_V2_STORE);
    const v1Table = await table<ResourceHighlight>(RESOURCE_HIGHLIGHTS_STORE);

    // Use toArray() and length instead of count()
    const v2Highlights = await v2Table.toArray();
    const v1Highlights = await v1Table.toArray();

    if (v2Highlights.length !== v1Highlights.length) {
      return {
        ok: false,
        details: `Highlight count mismatch: v1=${v1Highlights.length}, v2=${v2Highlights.length}`,
      };
    }

    // Create a Set of all v1 highlight IDs for faster lookup
    const v1Ids = new Set(v1Highlights.map((h) => h.id));

    // Verify all v2 highlights have corresponding v1 entries
    for (const h of v2Highlights) {
      if (!v1Ids.has(h.id)) {
        return {
          ok: false,
          details: `Missing v1 highlight for v2 ID: ${h.id}`,
        };
      }
    }

    await setMeta('migration:v13:lastVerifiedAt', Date.now());
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    await notifyDbError('verifyV13Migration', error);
    return { ok: false, details: error.message };
  }
}

export async function linkHighlightToCard(id: string, cardId: string): Promise<void> {
  try {
    const highlightsTable = await table<ResourceHighlight>(RESOURCE_HIGHLIGHTS_V2_STORE);
    const highlight = await highlightsTable.get(id);

    if (highlight) {
      // Create an updated version of the highlight
      const updatedHighlight: ResourceHighlight = {
        ...highlight,
        linkedCardId: cardId,
        updatedAt: Date.now(),
      };

      // Update the highlight in the database
      await highlightsTable.put(updatedHighlight, id);
      broadcastStorageWrite({ resource: RESOURCE_HIGHLIGHTS_V2_STORE });
    } else {
      throw new Error(`Highlight with ID ${id} not found`);
    }
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    await notifyDbError('linkHighlightToCard', error);
    throw error;
  }
}

export async function updateResourceHighlight(
  id: string,
  patch: Partial<ResourceHighlight>,
): Promise<void> {
  await withResourceLock(id, 'update-highlight', async () => {
    const t = await table(RESOURCE_HIGHLIGHTS_STORE);
    const existing = await t.get(id);
    if (!existing) throw new Error(`Highlight ${id} not found`);

    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    validate(ResourceHighlightSchema, updated, 'ResourceHighlight');

    await t.put(updated);
    broadcastStorageWrite({ resource: 'resource-highlight', id });

    // Enqueue a sync operation if this is linked to a card
    if (updated.linkedCardId) {
      await enqueueSyncOp({
        resource: 'resource-highlight',
        opType: 'update',
        id: updated.id || '',
        data: updated,
      });
    }
  });
}

// Deck operations
export async function getAllDecksFromDB(): Promise<DeckData[]> {
  const t = await table<DeckData>(DECKS_STORE);
  const result = await t.toArray();
  return result as DeckData[];
}

export async function saveDecksToDB(decks: DeckData[]): Promise<void> {
  await withTransaction([DECKS_STORE], 'rw', async (tx) => {
    const t = tx.table<DeckData>(DECKS_STORE);
    const existing = await t.toArray();
    const newIds = new Set(decks.map((d) => d.id));
    const toDelete = existing.map((d) => d.id).filter((id) => !newIds.has(id));
    if (toDelete.length) {
      await t.bulkDelete(toDelete);
    }
    if (decks.length) {
      await t.bulkPut(decks);
    }
  });
  broadcastStorageWrite({ resource: 'decks' });
}

// Exam operations
export async function getAllExamsFromDB(): Promise<ExamData[]> {
  const t = await table<ExamData>(EXAMS_STORE);
  const result = await t.toArray();
  return result as ExamData[];
}

export async function saveExamsToDB(exams: ExamData[]): Promise<void> {
  const t = await table<ExamData>(EXAMS_STORE);
  await t.bulkPut(exams);
  broadcastStorageWrite({ resource: 'exams' });
}

// Question Bank operations
export async function getAllQuestionBanksFromDB(): Promise<QuestionBankData[]> {
  const t = await table<QuestionBankData>(QUESTION_BANKS_STORE);
  const result = await t.toArray();
  return result as QuestionBankData[];
}

export async function saveQuestionBanksToDB(banks: QuestionBankData[]): Promise<void> {
  await withTransaction([QUESTION_BANKS_STORE], 'rw', async (tx) => {
    const t = tx.table<QuestionBankData>(QUESTION_BANKS_STORE);
    const existing = await t.toArray();
    const newIds = new Set(banks.map((b) => b.id));
    const toDelete = existing.map((b) => b.id).filter((id) => !newIds.has(id));
    if (toDelete.length) {
      await t.bulkDelete(toDelete);
    }
    if (banks.length) {
      await t.bulkPut(banks);
    }
  });
  broadcastStorageWrite({ resource: 'question-banks' });
}

// Introduction tracking
interface IntroductionsData {
  cardIds: string[];
  date: string;
}

interface McqIntroductionsData {
  ids: string[];
  mcqIds: string[]; // For backward compatibility
  date: string;
}

export async function getIntroductionsFromDB(): Promise<{ cardIds: string[]; date: string }> {
  const today = new Date().toISOString().split('T')[0];
  const t = await table<{ key: string; value: IntroductionsData }>(META_STORE);
  const rec = (await t.get('introductions')) as
    | { key: string; value: IntroductionsData }
    | undefined;
  const data = rec?.value;
  return data?.date === today
    ? { cardIds: data.cardIds, date: data.date }
    : { cardIds: [], date: today };
}

export async function saveIntroductionsToDB(
  params: { cardIds: string[]; date?: string } | string[],
): Promise<void> {
  let cardIds: string[];
  let date: string;

  if (Array.isArray(params)) {
    cardIds = params;
    date = new Date().toISOString().split('T')[0];
  } else {
    cardIds = params.cardIds;
    date = params.date || new Date().toISOString().split('T')[0];
  }

  const t = await table<{ key: string; value: IntroductionsData }>(META_STORE);
  await t.put({ key: 'introductions', value: { cardIds, date } }, 'introductions');
  broadcastStorageWrite({ resource: 'introductions' });
}

export async function getMcqIntroductionsFromDB(): Promise<{ ids: string[]; date: string }> {
  const today = new Date().toISOString().split('T')[0];
  const t = await table<{ key: string; value: McqIntroductionsData }>(META_STORE);
  const rec = (await t.get('mcq-introductions')) as
    | { key: string; value: McqIntroductionsData }
    | undefined;
  const data = rec?.value;
  if (data?.date === today) {
    return { ids: data.ids || data.mcqIds || [], date: data.date };
  }
  return { ids: [], date: today };
}

export async function saveMcqIntroductionsToDB(
  params: { ids: string[]; date?: string } | string[],
): Promise<void> {
  let ids: string[];
  let date: string;

  if (Array.isArray(params)) {
    ids = params;
    date = new Date().toISOString().split('T')[0];
  } else {
    ids = params.ids;
    date = params.date || new Date().toISOString().split('T')[0];
  }

  const t = await table<{ key: string; value: McqIntroductionsData }>(META_STORE);
  await t.put(
    { key: 'mcq-introductions', value: { ids, date, mcqIds: ids } },
    'mcq-introductions',
  );

  broadcastStorageWrite({ resource: 'mcq-introductions' });
  broadcastStorageWrite({ resource: 'decks', clear: true });
}

export async function clearQuestionBanksDB(): Promise<void> {
  const t = await table(QUESTION_BANKS_STORE);
  await t.clear();
  broadcastStorageWrite({ resource: 'question-banks', clear: true });
}

export async function clearMcqReviewLogsDB(): Promise<void> {
  const t = await table(MCQ_REVIEW_LOGS_STORE);
  await t.clear();
  broadcastStorageWrite({ resource: 'mcq-review-logs', clear: true });
}

// Exam log functions
export async function getExamLogFromDB(id: string): Promise<ExamLog | undefined> {
  const t = asTable<ExamLog>(await table(EXAM_LOGS_STORE));
  return t.get(id);
}

export async function getAllExamLogsFromDB(): Promise<ExamLog[]> {
  const t = asTable<ExamLog>(await table(EXAM_LOGS_STORE));
  return t.toArray();
}

export async function saveExamLogToDB(log: ExamLog): Promise<void> {
  const t = asTable<ExamLog>(await table(EXAM_LOGS_STORE));
  const now = Date.now();
  const logToSave: ExamLog = {
    ...log,
    updatedAt: now,
    createdAt: log.createdAt || now,
  };
  await t.put(logToSave);
  broadcastStorageWrite({ resource: 'exam-logs', id: log.id });
}

export async function deleteExamLogFromDB(id: string): Promise<void> {
  const t = asTable<ExamLog>(await table(EXAM_LOGS_STORE));
  await t.delete(id);
  broadcastStorageWrite({ resource: 'exam-logs', id });
}

// Review log functions
export interface ReviewLog {
  id: string;
  cardId: string;
  rating: number;
  state: number; // State enum value
  due: string; // ISO date string
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  review: string; // ISO date string of the review time
  duration?: number; // in seconds
  learning_steps?: number;
  createdAt: number;
}

export async function addReviewLog(log: Omit<ReviewLog, 'id' | 'createdAt'>): Promise<string> {
  const t = asTable<ReviewLog>(await table(REVIEW_LOGS_STORE));
  const id = crypto.randomUUID();

  // Ensure all required fields are present with proper types
  const reviewLog: ReviewLog = {
    ...log,
    id,
    createdAt: Date.now(),
    // Ensure required fields have default values if not provided
    state: log.state ?? 0,
    due: log.due ?? new Date().toISOString(),
    elapsed_days: log.elapsed_days ?? 0,
    last_elapsed_days: log.last_elapsed_days ?? 0,
    scheduled_days: log.scheduled_days ?? 0,
    review: log.review ?? new Date().toISOString(),
    duration: log.duration,
    learning_steps: log.learning_steps,
  };

  await t.add(reviewLog);
  broadcastStorageWrite({ resource: 'review-logs', id });
  return id;
}

export async function getReviewLogsForCard(cardId: string): Promise<ReviewLog[]> {
  const t = asTable<ReviewLog>(await table(REVIEW_LOGS_STORE));
  return t.where('cardId').equals(cardId).toArray();
}

export async function getAllReviewLogsFromDB(): Promise<ReviewLog[]> {
  const t = asTable<ReviewLog>(await table(REVIEW_LOGS_STORE));
  return t.toArray();
}

// MCQ Review log functions
export async function addMcqReviewLog(
  log: Omit<McqReviewLog, 'id' | 'createdAt'>,
): Promise<string> {
  const t = asTable<McqReviewLog>(await table(MCQ_REVIEW_LOGS_STORE));
  const id = crypto.randomUUID();
  const reviewLog = {
    ...log,
    id,
    createdAt: Date.now(),
  };
  await t.add(reviewLog);
  broadcastStorageWrite({ resource: 'mcq-review-logs', id });
  return id;
}

export async function getReviewLogsForMcq(mcqId: string): Promise<McqReviewLog[]> {
  const t = asTable<McqReviewLog>(await table(MCQ_REVIEW_LOGS_STORE));
  return t.where('mcqId').equals(mcqId).toArray();
}

export async function getAllMcqReviewLogsFromDB(): Promise<McqReviewLog[]> {
  const t = asTable<McqReviewLog>(await table(MCQ_REVIEW_LOGS_STORE));
  return t.toArray();
}

// Media management
export async function saveSingleMediaToDB(id: string, file: File): Promise<void> {
  const t = await table<MediaRecord>(MEDIA_STORE);
  const mediaRecord: MediaRecord = {
    id,
    blob: await file.arrayBuffer(),
    type: file.type,
    lastAccess: Date.now(),
  };
  await t.put(mediaRecord);
  broadcastStorageWrite({ resource: 'media', id });
}

export async function saveMediaToDB(files: Record<string, File>): Promise<void> {
  const t = await table<MediaRecord>(MEDIA_STORE);
  const records = await Promise.all(
    Object.entries(files).map(async ([id, file]) => ({
      id,
      blob: await file.arrayBuffer(),
      type: file.type,
      lastAccess: Date.now(),
    })),
  );
  await t.bulkPut(records);
  broadcastStorageWrite({ resource: 'media' });
}

export async function getMediaFromDB(id: string): Promise<Blob | undefined> {
  const t = await table<MediaRecord>(MEDIA_STORE);
  const record = await t.get(id);
  if (record?.blob) {
    record.lastAccess = Date.now();
    await t.put(record);
    return new Blob([record.blob], { type: record.type });
  }
  return undefined;
}

// Sync operations
export interface SyncOperation {
  resource: string;
  opType: 'create' | 'update' | 'delete' | 'upsert' | 'bulk-upsert';
  id?: string;
  data?: unknown;
  payload?: unknown;
  timestamp?: number;
  priority?: number;
}

export async function enqueueSyncOp(op: Omit<SyncOperation, 'timestamp'>): Promise<void> {
  await enqueueSyncOperation({ ...op, timestamp: Date.now(), priority: op.priority ?? 1 });
}

export async function enqueueCriticalSyncOp(
  op: Omit<SyncOperation, 'timestamp' | 'priority'>,
): Promise<void> {
  await enqueueSyncOperation({ ...op, timestamp: Date.now(), priority: 10 });
}

async function enqueueSyncOperation(op: SyncOperation & { timestamp: number }): Promise<void> {
  const t = await table(SYNC_QUEUE_STORE);
  await t.add({
    ...op,
    createdAt: op.timestamp,
    nextAttemptAt: op.timestamp,
  });
  broadcastStorageWrite({ resource: 'sync-queue' });
}

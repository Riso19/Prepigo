// Dexie adapter for Prepigo (opt-in via VITE_USE_DEXIE)
// Mirrors the API of src/lib/idb.ts so migration can be toggled via env.

import type { DeckData, ReviewLog } from '@/data/decks';
import type { QuestionBankData } from '@/data/questionBanks';
import type { ExamData } from '@/data/exams';

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

interface DbInstance {
  table: (name: string) => {
    get: (key: string) => Promise<unknown>;
    put: (value: unknown, key?: string) => Promise<unknown>;
    add: (value: unknown) => Promise<unknown>;
    clear: () => Promise<unknown>;
    bulkPut: (values: unknown[]) => Promise<unknown>;
    bulkDelete: (keys: number[]) => Promise<unknown>;
    where: (key: string) => {
      equals: (value: string) => {
        toArray: () => Promise<unknown[]>;
      };
      anyOf: (values: number[]) => {
        modify: (callback: (record: unknown) => void) => Promise<unknown>;
      };
    };
    orderBy: (key: string) => {
      limit: (limit: number) => {
        toArray: () => Promise<unknown[]>;
      };
      reverse: () => {
        toArray: () => Promise<unknown[]>;
      };
    };
    toArray: () => Promise<unknown[]>;
    delete: (key: string) => Promise<unknown>;
  };
  close: () => void;
}

let _db: DbInstance | null = null;

const DB_NAME = 'PrepigoDB';
// Schema version history:
// - v11: Introduced resources store
// - v12: Introduced resource_highlights store (non-destructive)
const DB_VERSION = 12;

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
} as const;

// Public types
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

async function getDb() {
  if (_db) {
    console.log('Returning cached database instance');
    return _db;
  }

  console.log('Initializing Dexie database...');
  const { Dexie } = await import('dexie');

  const buildDb = () => {
    console.log(`Building database schema up to version ${DB_VERSION}`);
    const db = new Dexie(DB_NAME);

    // Apply schema versions
    for (let i = 1; i <= DB_VERSION; i++) {
      const schema = SCHEMA_VERSIONS[i as keyof typeof SCHEMA_VERSIONS];
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
    return db;
  };

  let db = buildDb();
  try {
    console.log('Opening database...');
    await db.open();
    console.log('Database opened successfully');

    // Verify stores
    const stores = await db.table('meta').get('__db_stores');
    console.log('Available stores:', stores);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.error('Database open error:', e);

    // Handle legacy IndexedDBs where primary key changed historically
    if (
      msg.includes('Not yet support for changing primary key') ||
      msg.includes('No such table') ||
      msg.includes('not found')
    ) {
      console.warn('[Dexie] Schema mismatch detected. Attempting to rebuild database...');
      try {
        console.log('Deleting existing database...');
        await Dexie.delete(DB_NAME);
        console.log('Rebuilding database...');
        db = buildDb();
        await db.open();
        console.log('Database rebuilt successfully');
      } catch (re) {
        console.error('[Dexie] Rebuild failed:', re);
        throw new Error(`Failed to rebuild database: ${re}`);
      }
    } else {
      throw new Error(`Database error: ${msg}`);
    }
  }

  _db = db as unknown as DbInstance;
  return _db;
}

// ============ Resource Reading Progress =========
export type ResourceProgress = {
  resourceId: string;
  page: number;
  pageCount: number;
  updatedAt: number;
};

export async function getResourceProgress(
  resourceId: string,
): Promise<ResourceProgress | undefined> {
  const t = await table(META_STORE);
  const key = `resourceProgress:${resourceId}`;
  const rec = (await t.get(key)) as { value: ResourceProgress } | undefined;
  return rec?.value;
}

export async function setResourceProgress(resourceId: string, page: number, pageCount: number) {
  const t = await table(META_STORE);
  const key = `resourceProgress:${resourceId}`;
  await t.put({ key, value: { resourceId, page, pageCount, updatedAt: Date.now() } });
}

export async function table(name: string) {
  const db = await getDb();
  return db.table(name);
}

// --- Decks ---
export async function getAllDecksFromDB() {
  const t = await table(DECKS_STORE);
  return t.toArray() as Promise<DeckData[]>;
}

export async function saveDecksToDB(decks: DeckData[]) {
  const t = await table(DECKS_STORE);
  await t.clear();
  await t.bulkPut(decks);
}

export async function clearDecksDB() {
  const t = await table(DECKS_STORE);
  await t.clear();
}

// --- Review Logs ---
export async function addReviewLog(log: unknown) {
  const t = await table(REVIEW_LOGS_STORE);
  await t.add(log);
}

export async function getReviewLogsForCard(cardId: string) {
  const t = await table(REVIEW_LOGS_STORE);
  return t.where('cardId').equals(cardId).toArray();
}

export async function getAllReviewLogsFromDB() {
  const t = await table(REVIEW_LOGS_STORE);
  return t.toArray() as Promise<ReviewLog[]>;
}

export async function clearReviewLogsDB() {
  const t = await table(REVIEW_LOGS_STORE);
  await t.clear();
}

// --- MCQ Review Logs ---
export async function addMcqReviewLog(log: unknown) {
  const t = await table(MCQ_REVIEW_LOGS_STORE);
  await t.add(log);
}

export async function getReviewLogsForMcq(mcqId: string) {
  const t = await table(MCQ_REVIEW_LOGS_STORE);
  return t.where('mcqId').equals(mcqId).toArray();
}

export async function getAllMcqReviewLogsFromDB() {
  const t = await table(MCQ_REVIEW_LOGS_STORE);
  return t.toArray() as Promise<McqReviewLog[]>;
}

export async function clearMcqReviewLogsDB() {
  const t = await table(MCQ_REVIEW_LOGS_STORE);
  await t.clear();
}

// --- Media ---
interface MediaRecord {
  id: string;
  blob: ArrayBuffer;
  type: string;
}

export async function saveSingleMediaToDB(id: string, blob: Blob) {
  const t = await table(MEDIA_STORE);
  // Convert blob to ArrayBuffer for better storage in IndexedDB
  const arrayBuffer = await blob.arrayBuffer();
  await t.put({ id, blob: arrayBuffer, type: blob.type } as MediaRecord);
}

export async function saveMediaToDB(media: Map<string, Blob>) {
  const t = await table(MEDIA_STORE);
  const values: MediaRecord[] = [];

  for (const [id, blob] of media.entries()) {
    const arrayBuffer = await blob.arrayBuffer();
    values.push({
      id,
      blob: arrayBuffer,
      type: blob.type,
    });
  }

  await t.bulkPut(values);
}

export async function getMediaFromDB(id: string) {
  const t = await table(MEDIA_STORE);
  const result = (await t.get(id)) as MediaRecord | undefined;
  if (!result) return undefined;
  // Convert ArrayBuffer back to Blob
  return new Blob([result.blob], { type: result.type || 'application/octet-stream' });
}

export async function clearMediaDB() {
  const t = await table(MEDIA_STORE);
  await t.clear();
}

// --- Session State ---
export async function getIntroductionsFromDB() {
  const t = await table(SESSION_STATE_STORE);
  return t.get('introductionsToday') as Promise<{ date: string; ids: string[] } | undefined>;
}

export async function saveIntroductionsToDB(introductions: { date: string; ids: string[] }) {
  const t = await table(SESSION_STATE_STORE);
  await t.put(introductions, 'introductionsToday');
}

export async function getMcqIntroductionsFromDB() {
  const t = await table(SESSION_STATE_STORE);
  return t.get('mcqIntroductionsToday') as Promise<{ date: string; ids: string[] } | undefined>;
}

export async function saveMcqIntroductionsToDB(introductions: { date: string; ids: string[] }) {
  const t = await table(SESSION_STATE_STORE);
  await t.put(introductions, 'mcqIntroductionsToday');
}

// --- Question Banks ---
export async function getAllQuestionBanksFromDB() {
  const t = await table(QUESTION_BANKS_STORE);
  return t.toArray() as Promise<QuestionBankData[]>;
}

export async function saveQuestionBanksToDB(questionBanks: QuestionBankData[]) {
  const t = await table(QUESTION_BANKS_STORE);
  await t.clear();
  await t.bulkPut(questionBanks);
}

export async function clearQuestionBanksDB() {
  const t = await table(QUESTION_BANKS_STORE);
  await t.clear();
}

// --- Exams ---
export async function getAllExamsFromDB() {
  const t = await table(EXAMS_STORE);
  return t.toArray() as Promise<ExamData[]>;
}

export async function saveExamsToDB(exams: ExamData[]) {
  const t = await table(EXAMS_STORE);
  await t.clear();
  await t.bulkPut(exams);
}

export async function clearExamsDB() {
  const t = await table(EXAMS_STORE);
  await t.clear();
}

// --- Exam Logs ---
export async function saveExamLogToDB(log: unknown) {
  const t = await table(EXAM_LOGS_STORE);
  await t.put(log);
}

export async function getAllExamLogsFromDB() {
  const t = await table(EXAM_LOGS_STORE);
  return t.toArray();
}

export async function getExamLogFromDB(id: string) {
  const t = await table(EXAM_LOGS_STORE);
  return t.get(id);
}

export async function closeDexie() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ============ Sync Queue & Meta (v10+) ============
interface SyncOperation {
  id?: number;
  resource: string;
  opType: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
}

// Operation format: { id, resource, opType, payload, createdAt, retryCount }
interface SyncOperationInternal extends Omit<SyncOperation, 'id'> {
  id?: number;
}

export async function enqueueSyncOp(op: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount'>) {
  const t = await table(SYNC_QUEUE_STORE);
  const now = Date.now();
  const opWithOptional = op as Partial<SyncOperation>;
  const rec: SyncOperationInternal = {
    resource: op.resource,
    opType: op.opType,
    payload: op.payload ?? null,
    createdAt: opWithOptional.createdAt ?? now,
    retryCount: opWithOptional.retryCount ?? 0,
  };
  return t.add(rec);
}

export async function takeSyncBatch(limit = 20) {
  const t = await table(SYNC_QUEUE_STORE);
  return t.orderBy('createdAt').limit(limit).toArray();
}

export async function markOpsAsSynced(ids: number[]) {
  if (!ids?.length) return;
  const t = await table(SYNC_QUEUE_STORE);
  await t.bulkDelete(ids);
}

export async function incrementRetry(ids: number[]) {
  if (!ids?.length) return;
  const t = await table(SYNC_QUEUE_STORE);
  await (
    t.where('id').anyOf(ids) as unknown as {
      modify: (fn: (rec: { retryCount?: number }) => void) => Promise<void>;
    }
  ).modify((rec) => {
    rec.retryCount = (rec.retryCount || 0) + 1;
  });
}

export async function getMeta(key: string) {
  const t = await table(META_STORE);
  return t.get(key)?.then((v: unknown) => (v as { value: unknown })?.value);
}

export async function setMeta(key: string, value: unknown) {
  const t = await table(META_STORE);
  await t.put({ key, value });
}

// List meta keys by prefix (utility for conflict discovery)
export async function listMetaKeys(prefix: string) {
  const t = await table(META_STORE);
  const all = (await t.toArray()) as { key: string }[];
  return all.map((r) => r.key).filter((k) => typeof k === 'string' && k.startsWith(prefix));
}

export async function deleteMeta(key: string) {
  const t = await table(META_STORE);
  await t.delete(key);
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
  const t = await table(RESOURCES_STORE);
  await t.put(resource);
}

export async function getAllResourcesFromDB(): Promise<ResourceItem[]> {
  try {
    console.log('Getting all resources from DB...');
    const t = await table(RESOURCES_STORE);
    console.log('Table access successful, querying resources...');

    try {
      // Try with the indexed query first
      const resources = (await t.orderBy('createdAt').reverse().toArray()) as ResourceItem[];
      console.log(`Successfully retrieved ${resources.length} resources`);
      return resources;
    } catch (queryError) {
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

    // If we get an error about the store not existing, we might need to recreate the database
    if (
      error instanceof Error &&
      (error.message.includes('not found') ||
        error.message.includes('no such table') ||
        error.message.includes('does not exist'))
    ) {
      console.warn('Resources store not found, attempting to recreate database...');
      try {
        const { Dexie } = await import('dexie');
        await Dexie.delete(DB_NAME);
        // Clear the cached database instance to force a fresh initialization
        _db = null;
        // Try again with a fresh database
        return getAllResourcesFromDB();
      } catch (recreateError) {
        console.error('Failed to recreate database:', recreateError);
      }
    }

    throw error;
  }
}

export async function deleteResource(id: string) {
  const t = await table(RESOURCES_STORE);
  await t.delete(id);
}

export async function getResourceById(id: string): Promise<ResourceItem | undefined> {
  const t = await table(RESOURCES_STORE);
  return t.get(id) as Promise<ResourceItem | undefined>;
}

export async function getResourceBlob(resource: ResourceItem) {
  return getMediaFromDB(resource.mediaId);
}

// ============ Resource Highlights (v12+) =========
export type ResourceHighlight = {
  id: string; // uuid
  resourceId: string;
  page: number;
  // Rectangles in page coordinate space (scale 1)
  rects: { x: number; y: number; w: number; h: number; page: number }[];
  text?: string;
  createdAt: number;
  linkedCardId?: string;
  color?: 'yellow' | 'green' | 'blue' | 'pink';
  note?: string;
};

export async function saveResourceHighlight(highlight: ResourceHighlight) {
  const t = await table(RESOURCE_HIGHLIGHTS_STORE);
  await t.put(highlight);
}

export async function getHighlightsForResource(resourceId: string): Promise<ResourceHighlight[]> {
  const t = await table(RESOURCE_HIGHLIGHTS_STORE);
  return t.where('resourceId').equals(resourceId).toArray() as Promise<ResourceHighlight[]>;
}

export async function deleteResourceHighlight(id: string) {
  const t = await table(RESOURCE_HIGHLIGHTS_STORE);
  await t.delete(id);
}

export async function linkHighlightToCard(id: string, cardId: string) {
  const t = await table(RESOURCE_HIGHLIGHTS_STORE);
  await (
    t.where('id').equals(id) as unknown as {
      modify: (fn: (rec: ResourceHighlight) => void) => Promise<void>;
    }
  ).modify((rec) => {
    rec.linkedCardId = cardId;
  });
}

export async function updateResourceHighlight(id: string, patch: Partial<ResourceHighlight>) {
  const t = await table(RESOURCE_HIGHLIGHTS_STORE);
  await (
    t.where('id').equals(id) as unknown as {
      modify: (fn: (rec: ResourceHighlight) => void) => Promise<void>;
    }
  ).modify((rec) => {
    Object.assign(rec, patch);
  });
}

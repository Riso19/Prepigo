// Dexie adapter for Prepigo (opt-in via VITE_USE_DEXIE)
// Mirrors the API of src/lib/idb.ts so migration can be toggled via env.

import type { DeckData, ReviewLog } from '@/data/decks';
import type { QuestionBankData } from '@/data/questionBanks';
import type { ExamData } from '@/data/exams';

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
const DB_VERSION = 12; // v12 introduces resource_highlights store (non-destructive)

// Store names (must match src/lib/idb.ts)
const DECKS_STORE = 'decks';
const REVIEW_LOGS_STORE = 'review_logs';
const MEDIA_STORE = 'media';
const SESSION_STATE_STORE = 'session_state';
const QUESTION_BANKS_STORE = 'question_banks';
const MCQ_REVIEW_LOGS_STORE = 'mcq_review_logs';
const EXAMS_STORE = 'exams';
const EXAM_LOGS_STORE = 'exam_logs';
const SYNC_QUEUE_STORE = 'syncQueue';
const META_STORE = 'meta';
const RESOURCES_STORE = 'resources';
const RESOURCE_HIGHLIGHTS_STORE = 'resource_highlights';

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
  if (_db) return _db;
  const { Dexie } = await import('dexie');
  const db = new Dexie(DB_NAME);

  // Define schema versions equivalent to idb upgrade steps
  db.version(1).stores({
    [DECKS_STORE]: 'id',
  });
  db.version(2).stores({
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });
  db.version(3).stores({
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });
  db.version(4).stores({
    [SESSION_STATE_STORE]: '', // key-value
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });
  db.version(5).stores({
    [QUESTION_BANKS_STORE]: 'id',
    [SESSION_STATE_STORE]: '',
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });
  db.version(6).stores({
    [MCQ_REVIEW_LOGS_STORE]: '++id, mcqId',
    [QUESTION_BANKS_STORE]: 'id',
    [SESSION_STATE_STORE]: '',
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });
  db.version(8).stores({
    [EXAMS_STORE]: 'id',
    [MCQ_REVIEW_LOGS_STORE]: '++id, mcqId',
    [QUESTION_BANKS_STORE]: 'id',
    [SESSION_STATE_STORE]: '',
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });
  db.version(9).stores({
    [EXAM_LOGS_STORE]: 'id',
    [EXAMS_STORE]: 'id',
    [MCQ_REVIEW_LOGS_STORE]: '++id, mcqId',
    [QUESTION_BANKS_STORE]: 'id',
    [SESSION_STATE_STORE]: '',
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });

  // v10: Add syncQueue and meta stores (non-destructive)
  db.version(10).stores({
    [SYNC_QUEUE_STORE]: '++id, resource, createdAt',
    [META_STORE]: 'key',
    [EXAM_LOGS_STORE]: 'id',
    [EXAMS_STORE]: 'id',
    [MCQ_REVIEW_LOGS_STORE]: '++id, mcqId',
    [QUESTION_BANKS_STORE]: 'id',
    [SESSION_STATE_STORE]: '',
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });

  // v11: Add resources store for organizing PDFs (metadata only; blobs go to MEDIA_STORE)
  db.version(11).stores({
    [RESOURCES_STORE]: 'id, createdAt, updatedAt, title, tags',
    [SYNC_QUEUE_STORE]: '++id, resource, createdAt',
    [META_STORE]: 'key',
    [EXAM_LOGS_STORE]: 'id',
    [EXAMS_STORE]: 'id',
    [MCQ_REVIEW_LOGS_STORE]: '++id, mcqId',
    [QUESTION_BANKS_STORE]: 'id',
    [SESSION_STATE_STORE]: '',
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });

  // v12: Add resource_highlights store to persist PDF annotations/highlights
  db.version(12).stores({
    [RESOURCE_HIGHLIGHTS_STORE]: 'id, resourceId, page, createdAt, linkedCardId',
    [RESOURCES_STORE]: 'id, createdAt, updatedAt, title, tags',
    [SYNC_QUEUE_STORE]: '++id, resource, createdAt',
    [META_STORE]: 'key',
    [EXAM_LOGS_STORE]: 'id',
    [EXAMS_STORE]: 'id',
    [MCQ_REVIEW_LOGS_STORE]: '++id, mcqId',
    [QUESTION_BANKS_STORE]: 'id',
    [SESSION_STATE_STORE]: '',
    [MEDIA_STORE]: 'id',
    [REVIEW_LOGS_STORE]: '++id, cardId',
    [DECKS_STORE]: 'id',
  });

  await db.open();
  _db = db;
  return _db;
}

// ============ Resource Reading Progress =========
export type ResourceProgress = {
  resourceId: string;
  page: number;
  pageCount: number;
  updatedAt: number;
};

export async function getResourceProgress(resourceId: string): Promise<ResourceProgress | undefined> {
  const t = await table(META_STORE);
  const key = `resourceProgress:${resourceId}`;
  const rec = await t.get(key);
  return rec?.value as ResourceProgress | undefined;
}

export async function setResourceProgress(resourceId: string, page: number, pageCount: number) {
  const t = await table(META_STORE);
  const key = `resourceProgress:${resourceId}`;
  await t.put({ key, value: { resourceId, page, pageCount, updatedAt: Date.now() } });
}

async function table(name: string) {
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
export async function saveSingleMediaToDB(id: string, blob: Blob) {
  const t = await table(MEDIA_STORE);
  await t.put({ id, blob });
}

export async function saveMediaToDB(media: Map<string, Blob>) {
  const t = await table(MEDIA_STORE);
  const values: { id: string; blob: Blob }[] = [];
  for (const [id, blob] of media.entries()) values.push({ id, blob });
  await t.bulkPut(values);
}

export async function getMediaFromDB(id: string) {
  const t = await table(MEDIA_STORE);
  const res = await t.get(id);
  return res?.blob as Blob | undefined;
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
export async function enqueueSyncOp(op: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount'>) {
  const t = await table(SYNC_QUEUE_STORE);
  const now = Date.now();
  const rec: SyncOperation = {
    resource: op.resource,
    opType: op.opType,
    payload: op.payload ?? null,
    createdAt: op.createdAt ?? now,
    retryCount: op.retryCount ?? 0,
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
  await t.where('id').anyOf(ids).modify((rec: SyncOperation) => {
    rec.retryCount = (rec.retryCount || 0) + 1;
  });
}

export async function getMeta(key: string) {
  const t = await table(META_STORE);
  return t.get(key)?.then((v: { value: unknown } | undefined) => v?.value);
}

export async function setMeta(key: string, value: unknown) {
  const t = await table(META_STORE);
  await t.put({ key, value });
}

// List meta keys by prefix (utility for conflict discovery)
export async function listMetaKeys(prefix: string) {
  const t = await table(META_STORE);
  const all = await t.toArray() as { key: string }[];
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
  const t = await table(RESOURCES_STORE);
  return t.orderBy('createdAt').reverse().toArray();
}

export async function deleteResource(id: string) {
  const t = await table(RESOURCES_STORE);
  await t.delete(id);
}

export async function getResourceById(id: string): Promise<ResourceItem | undefined> {
  const t = await table(RESOURCES_STORE);
  return t.get(id);
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
  return t.where('resourceId').equals(resourceId).toArray();
}

export async function deleteResourceHighlight(id: string) {
  const t = await table(RESOURCE_HIGHLIGHTS_STORE);
  await t.delete(id);
}

export async function linkHighlightToCard(id: string, cardId: string) {
  const t = await table(RESOURCE_HIGHLIGHTS_STORE);
  await t.where('id').equals(id).modify((rec: ResourceHighlight) => {
    rec.linkedCardId = cardId;
  });
}

export async function updateResourceHighlight(id: string, patch: Partial<ResourceHighlight>) {
  const t = await table(RESOURCE_HIGHLIGHTS_STORE);
  await t.where('id').equals(id).modify((rec: ResourceHighlight) => {
    Object.assign(rec, patch);
  });
}

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DeckData, ReviewLog } from '@/data/decks';

const DB_NAME = 'PrepigoDB';
const DB_VERSION = 3; // Increment version to trigger upgrade
const DECKS_STORE = 'decks';
const REVIEW_LOGS_STORE = 'review_logs';
const MEDIA_STORE = 'media';

interface PrepigoDB extends DBSchema {
  [DECKS_STORE]: {
    key: string;
    value: DeckData;
  };
  [REVIEW_LOGS_STORE]: {
    key: number;
    value: ReviewLog;
    indexes: { 'cardId': string };
  };
  [MEDIA_STORE]: {
    key: string; // filename
    value: { id: string; blob: Blob };
  };
}

let dbPromise: Promise<IDBPDatabase<PrepigoDB>>;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<PrepigoDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(DECKS_STORE)) {
            db.createObjectStore(DECKS_STORE, { keyPath: 'id' });
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(REVIEW_LOGS_STORE)) {
            const store = db.createObjectStore(REVIEW_LOGS_STORE, { autoIncrement: true });
            store.createIndex('cardId', 'cardId');
          }
        }
        if (oldVersion < 3) {
            if (!db.objectStoreNames.contains(MEDIA_STORE)) {
                db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
            }
        }
      },
    });
  }
  return dbPromise;
};

export const getAllDecksFromDB = async (): Promise<DeckData[]> => {
  const db = await getDb();
  return db.getAll(DECKS_STORE);
};

export const saveDecksToDB = async (decks: DeckData[]): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction(DECKS_STORE, 'readwrite');
  await tx.store.clear();
  await Promise.all(decks.map(deck => tx.store.put(deck)));
  await tx.done;
};

export const clearDecksDB = async (): Promise<void> => {
  const db = await getDb();
  await db.clear(DECKS_STORE);
};

// --- Review Log Functions ---

export const addReviewLog = async (log: ReviewLog): Promise<void> => {
  const db = await getDb();
  await db.add(REVIEW_LOGS_STORE, log);
};

export const getReviewLogsForCard = async (cardId: string): Promise<ReviewLog[]> => {
  const db = await getDb();
  return db.getAllFromIndex(REVIEW_LOGS_STORE, 'cardId', cardId);
};

export const clearReviewLogsDB = async (): Promise<void> => {
  const db = await getDb();
  await db.clear(REVIEW_LOGS_STORE);
};

// --- Media Functions ---

export const saveMediaToDB = async (media: Map<string, Blob>): Promise<void> => {
    const db = await getDb();
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const promises: Promise<any>[] = [];
    for (const [id, blob] of media.entries()) {
        promises.push(tx.store.put({ id, blob }));
    }
    await Promise.all(promises);
    await tx.done;
};

export const getMediaFromDB = async (id: string): Promise<Blob | undefined> => {
    const db = await getDb();
    const result = await db.get(MEDIA_STORE, id);
    return result?.blob;
};

export const clearMediaDB = async (): Promise<void> => {
    const db = await getDb();
    await db.clear(MEDIA_STORE);
};
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DeckData } from '@/data/decks';

const DB_NAME = 'PrepigoDB';
const DB_VERSION = 1;
const DECKS_STORE = 'decks';

interface PrepigoDB extends DBSchema {
  [DECKS_STORE]: {
    key: string;
    value: DeckData;
  };
}

let dbPromise: Promise<IDBPDatabase<PrepigoDB>>;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<PrepigoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DECKS_STORE)) {
          db.createObjectStore(DECKS_STORE, { keyPath: 'id' });
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
  // Clear existing decks before saving the new state
  await tx.store.clear();
  await Promise.all(decks.map(deck => tx.store.put(deck)));
  await tx.done;
};

export const clearDecksDB = async (): Promise<void> => {
  const db = await getDb();
  await db.clear(DECKS_STORE);
};
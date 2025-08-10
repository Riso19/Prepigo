import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DeckData, ReviewLog } from '@/data/decks';
import { QuestionBankData } from '@/data/questionBanks';
import { ExamData } from '@/data/exams';

const DB_NAME = 'PrepigoDB';
const DB_VERSION = 8; // Increment version to trigger upgrade
const DECKS_STORE = 'decks';
const REVIEW_LOGS_STORE = 'review_logs';
const MEDIA_STORE = 'media';
const SESSION_STATE_STORE = 'session_state';
const QUESTION_BANKS_STORE = 'question_banks';
const MCQ_REVIEW_LOGS_STORE = 'mcq_review_logs';
const EXAMS_STORE = 'exams';

export type McqReviewLog = Omit<ReviewLog, 'cardId'> & { mcqId: string };

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
  [MCQ_REVIEW_LOGS_STORE]: {
    key: number;
    value: McqReviewLog;
    indexes: { 'mcqId': string };
  };
  [MEDIA_STORE]: {
    key: string; // filename
    value: { id: string; blob: Blob };
  };
  [SESSION_STATE_STORE]: {
    key: string;
    value: any;
  };
  [QUESTION_BANKS_STORE]: {
    key: string;
    value: QuestionBankData;
  };
  [EXAMS_STORE]: {
    key: string;
    value: ExamData;
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
        if (oldVersion < 4) {
            if (!db.objectStoreNames.contains(SESSION_STATE_STORE)) {
                db.createObjectStore(SESSION_STATE_STORE);
            }
        }
        if (oldVersion < 5) {
            if (!db.objectStoreNames.contains(QUESTION_BANKS_STORE)) {
                db.createObjectStore(QUESTION_BANKS_STORE, { keyPath: 'id' });
            }
        }
        if (oldVersion < 6) {
            if (!db.objectStoreNames.contains(MCQ_REVIEW_LOGS_STORE)) {
                const store = db.createObjectStore(MCQ_REVIEW_LOGS_STORE, { autoIncrement: true });
                store.createIndex('mcqId', 'mcqId');
            }
        }
        if (oldVersion < 8) {
            if (!db.objectStoreNames.contains(EXAMS_STORE)) {
                db.createObjectStore(EXAMS_STORE, { keyPath: 'id' });
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

export const getAllReviewLogsFromDB = async (): Promise<ReviewLog[]> => {
    const db = await getDb();
    return db.getAll(REVIEW_LOGS_STORE);
};

// --- MCQ Review Log Functions ---

export const addMcqReviewLog = async (log: McqReviewLog): Promise<void> => {
  const db = await getDb();
  await db.add(MCQ_REVIEW_LOGS_STORE, log);
};

export const getReviewLogsForMcq = async (mcqId: string): Promise<McqReviewLog[]> => {
  const db = await getDb();
  return db.getAllFromIndex(MCQ_REVIEW_LOGS_STORE, 'mcqId', mcqId);
};

export const getAllMcqReviewLogsFromDB = async (): Promise<McqReviewLog[]> => {
    const db = await getDb();
    return db.getAll(MCQ_REVIEW_LOGS_STORE);
};

export const clearMcqReviewLogsDB = async (): Promise<void> => {
  const db = await getDb();
  await db.clear(MCQ_REVIEW_LOGS_STORE);
};


// --- Media Functions ---

export const saveSingleMediaToDB = async (id: string, blob: Blob): Promise<void> => {
    const db = await getDb();
    await db.put(MEDIA_STORE, { id, blob });
};

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

// --- Session State Functions ---
export const getIntroductionsFromDB = async (): Promise<{ date: string; ids: string[] } | undefined> => {
  const db = await getDb();
  return db.get(SESSION_STATE_STORE, 'introductionsToday');
};

export const saveIntroductionsToDB = async (introductions: { date: string; ids: string[] }): Promise<void> => {
  const db = await getDb();
  await db.put(SESSION_STATE_STORE, introductions, 'introductionsToday');
};

export const getMcqIntroductionsFromDB = async (): Promise<{ date: string; ids: string[] } | undefined> => {
  const db = await getDb();
  return db.get(SESSION_STATE_STORE, 'mcqIntroductionsToday');
};

export const saveMcqIntroductionsToDB = async (introductions: { date: string; ids: string[] }): Promise<void> => {
  const db = await getDb();
  await db.put(SESSION_STATE_STORE, introductions, 'mcqIntroductionsToday');
};

// --- Question Bank Functions ---
export const getAllQuestionBanksFromDB = async (): Promise<QuestionBankData[]> => {
  const db = await getDb();
  return db.getAll(QUESTION_BANKS_STORE);
};

export const saveQuestionBanksToDB = async (questionBanks: QuestionBankData[]): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction(QUESTION_BANKS_STORE, 'readwrite');
  await tx.store.clear();
  await Promise.all(questionBanks.map(bank => tx.store.put(bank)));
  await tx.done;
};

export const clearQuestionBanksDB = async (): Promise<void> => {
  const db = await getDb();
  await db.clear(QUESTION_BANKS_STORE);
};

// --- Exam Functions ---
export const getAllExamsFromDB = async (): Promise<ExamData[]> => {
  const db = await getDb();
  return db.getAll(EXAMS_STORE);
};

export const saveExamsToDB = async (exams: ExamData[]): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction(EXAMS_STORE, 'readwrite');
  await tx.store.clear();
  await Promise.all(exams.map(exam => tx.store.put(exam)));
  await tx.done;
};

export const clearExamsDB = async (): Promise<void> => {
  const db = await getDb();
  await db.clear(EXAMS_STORE);
};
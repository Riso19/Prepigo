import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { FSRSParameters, generatorParameters } from "ts-fsrs";
import * as z from 'zod';

const DB_NAME = 'PrepigoSettingsDB';
const DB_VERSION = 1;
const SETTINGS_STORE = 'settings';

const fsrsParametersSchema = z.object({
    request_retention: z.coerce.number().min(0.7, "Must be at least 0.7").max(0.99, "Must be less than 1.0"),
    maximum_interval: z.coerce.number().int().min(1, "Must be at least 1 day"),
    w: z.array(z.number()),
});

export const srsSettingsSchema = z.object({
  scheduler: z.enum(['fsrs', 'sm2']),
  fsrsParameters: fsrsParametersSchema,
  sm2StartingEase: z.coerce.number().min(1.3, "Must be at least 1.3"),
  sm2MinEasinessFactor: z.coerce.number().min(1.3, "Must be at least 1.3"),
  sm2EasyBonus: z.coerce.number().min(1, "Must be at least 1.0"),
  sm2IntervalModifier: z.coerce.number().min(0.1, "Must be at least 0.1"),
  sm2HardIntervalMultiplier: z.coerce.number().min(1.0, "Must be at least 1.0"),
  sm2LapsedIntervalMultiplier: z.coerce.number().min(0, "Must be at least 0").max(1, "Must be 1.0 or less"),
  sm2MaximumInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  sm2GraduatingInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  sm2EasyInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  sm2MinimumInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  learningSteps: z.string().regex(/^(\d+[smhd]?\s*)*\d+[smhd]?$/, "Must be space-separated numbers with optional s,m,h,d units."),
  relearningSteps: z.string().regex(/^(\d+[smhd]?\s*)*\d+[smhd]?$/, "Must be space-separated numbers with optional s,m,h,d units."),
  leechThreshold: z.coerce.number().int().min(1, "Must be at least 1"),
  leechAction: z.enum(['tag', 'suspend']),
  newCardsPerDay: z.coerce.number().int().min(0, "Must be 0 or greater"),
  maxReviewsPerDay: z.coerce.number().int().min(0, "Must be 0 or greater"),
  newCardInsertionOrder: z.enum(['sequential', 'random']),
  newCardGatherOrder: z.enum(['deck', 'ascending', 'descending', 'randomNotes', 'randomCards']),
  newCardSortOrder: z.enum(['gathered', 'typeThenGathered', 'typeThenRandom', 'randomNote', 'random']),
  newReviewOrder: z.enum(['mix', 'after', 'before']),
  interdayLearningReviewOrder: z.enum(['mix', 'after', 'before']),
  reviewSortOrder: z.enum(['dueDateRandom', 'dueDateDeck', 'overdue']),
  buryNewSiblings: z.boolean(),
  buryReviewSiblings: z.boolean(),
  buryInterdayLearningSiblings: z.boolean(),
});

export type SrsSettings = z.infer<typeof srsSettingsSchema>;

interface SettingsDB extends DBSchema {
  [SETTINGS_STORE]: {
    key: string;
    value: SrsSettings;
  };
}

const defaultFsrsParams = generatorParameters();

const defaultSettings: SrsSettings = {
  scheduler: 'fsrs',
  fsrsParameters: {
    ...defaultFsrsParams,
    w: [...defaultFsrsParams.w],
  },
  sm2StartingEase: 2.5,
  sm2MinEasinessFactor: 1.3,
  sm2EasyBonus: 1.3,
  sm2IntervalModifier: 1.0,
  sm2HardIntervalMultiplier: 1.2,
  sm2LapsedIntervalMultiplier: 0.6,
  sm2MaximumInterval: 365,
  sm2GraduatingInterval: 1,
  sm2EasyInterval: 4,
  sm2MinimumInterval: 1,
  learningSteps: "1 10", // in minutes, space-separated
  relearningSteps: "10", // in minutes, space-separated
  leechThreshold: 8,
  leechAction: 'tag',
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  newCardInsertionOrder: 'sequential',
  newCardGatherOrder: 'deck',
  newCardSortOrder: 'typeThenGathered',
  newReviewOrder: 'mix',
  interdayLearningReviewOrder: 'mix',
  reviewSortOrder: 'dueDateRandom',
  buryNewSiblings: false,
  buryReviewSiblings: false,
  buryInterdayLearningSiblings: false,
};

// --- Database Functions ---
let settingsDbPromise: Promise<IDBPDatabase<SettingsDB>>;
const getSettingsDb = () => {
  if (!settingsDbPromise) {
    settingsDbPromise = openDB<SettingsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
      },
    });
  }
  return settingsDbPromise;
};

const getSettingsFromDB = async (): Promise<SrsSettings | null> => {
  const db = await getSettingsDb();
  const settings = await db.get(SETTINGS_STORE, 'srsSettings');
  return settings ? { ...defaultSettings, ...settings } : null;
};

const saveSettingsToDB = async (settings: SrsSettings): Promise<void> => {
  const db = await getSettingsDb();
  await db.put(SETTINGS_STORE, settings, 'srsSettings');
};

export const clearSettingsDB = async (): Promise<void> => {
    const db = await getSettingsDb();
    await db.clear(SETTINGS_STORE);
};


// --- React Context ---
interface SettingsContextType {
  settings: SrsSettings;
  setSettings: (newSettings: SrsSettings) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettingsState] = useState<SrsSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        let dbSettings = await getSettingsFromDB();
        if (!dbSettings) {
          await saveSettingsToDB(defaultSettings);
          dbSettings = defaultSettings;
        }
        setSettingsState(dbSettings);
      } catch (error) {
        console.error("Failed to load settings, falling back to defaults.", error);
        setSettingsState(defaultSettings);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const setSettings = (newSettings: SrsSettings) => {
    setSettingsState(newSettings);
    saveSettingsToDB(newSettings).catch(error => {
      console.error("Failed to save settings", error);
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings, isLoading }}>
      {!isLoading && children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
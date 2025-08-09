import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { FSRSParameters, generatorParameters } from "ts-fsrs";

const DB_NAME = 'PrepigoSettingsDB';
const DB_VERSION = 1;
const SETTINGS_STORE = 'settings';

export interface SrsSettings {
  scheduler: 'fsrs' | 'sm2';
  fsrsParameters: FSRSParameters;
  // SM-2 specific
  sm2StartingEase: number;
  sm2MinEasinessFactor: number;
  sm2EasyBonus: number;
  sm2IntervalModifier: number;
  sm2HardIntervalMultiplier: number;
  sm2LapsedIntervalMultiplier: number;
  sm2MaximumInterval: number;
  sm2GraduatingInterval: number;
  sm2EasyInterval: number;
  sm2MinimumInterval: number;
  learningSteps: string;
  relearningSteps: string;
  leechThreshold: number;
  leechAction: 'tag' | 'suspend';
  // General
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  newCardGatherOrder: 'deck' | 'ascending' | 'descending' | 'randomNotes' | 'randomCards';
  newCardSortOrder: 'gathered' | 'typeThenGathered' | 'typeThenRandom' | 'randomNote' | 'random';
  newReviewOrder: 'mix' | 'after' | 'before';
  interdayLearningReviewOrder: 'mix' | 'after' | 'before';
  reviewSortOrder: 'dueDateRandom' | 'dueDateDeck' | 'overdue';
  buryNewSiblings: boolean;
  buryReviewSiblings: boolean;
  buryInterdayLearningSiblings: boolean;
}

interface SettingsDB extends DBSchema {
  [SETTINGS_STORE]: {
    key: string;
    value: SrsSettings;
  };
}

const defaultSettings: SrsSettings = {
  scheduler: 'fsrs',
  fsrsParameters: generatorParameters(),
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
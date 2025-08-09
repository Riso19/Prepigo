import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { FSRSParameters, defaultFSRSParameters } from "@/lib/fsrs";

const DB_NAME = 'PrepigoSettingsDB';
const DB_VERSION = 1;
const SETTINGS_STORE = 'settings';

export interface SrsSettings {
  // Algorithm Choice
  algorithm: 'sm2' | 'fsrs';
  fsrsParameters: FSRSParameters;

  // Daily Limits
  newCardsPerDay: number;
  maxReviewsPerDay: number;

  // New Cards (SM-2)
  learningSteps: string;
  graduatingInterval: number;
  easyInterval: number;
  insertionOrder: 'sequential' | 'random';

  // Lapses (SM-2)
  relearningSteps: string;
  minimumInterval: number;
  leechThreshold: number;
  leechAction: 'tagOnly' | 'suspend';

  // Burying (SM-2)
  buryNewSiblings: boolean;
  buryReviewSiblings: boolean;
  buryInterdayLearningSiblings: boolean;

  // Advanced (SM-2)
  maximumInterval: number;
  initialEaseFactor: number;
  easyBonus: number;
  intervalModifier: number;
  hardInterval: number;
  newInterval: number;
  minEaseFactor: number;
}

interface SettingsDB extends DBSchema {
  [SETTINGS_STORE]: {
    key: string;
    value: SrsSettings;
  };
}

const defaultSettings: SrsSettings = {
  // Algorithm Choice
  algorithm: 'sm2',
  fsrsParameters: defaultFSRSParameters,

  // Daily Limits
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,

  // New Cards
  learningSteps: "10m 1d",
  graduatingInterval: 7,
  easyInterval: 10,
  insertionOrder: 'sequential',

  // Lapses
  relearningSteps: "10m",
  minimumInterval: 1,
  leechThreshold: 8,
  leechAction: 'tagOnly',

  // Burying
  buryNewSiblings: true,
  buryReviewSiblings: true,
  buryInterdayLearningSiblings: true,

  // Advanced
  maximumInterval: 365,
  initialEaseFactor: 2.5,
  easyBonus: 1.3,
  intervalModifier: 1.0,
  hardInterval: 1.2,
  newInterval: 0.6,
  minEaseFactor: 1.3,
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
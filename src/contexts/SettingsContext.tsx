import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { generatorParameters } from 'ts-fsrs';
import * as z from 'zod';

const DB_NAME = 'PrepigoSettingsDB';
const DB_VERSION = 1;
const SETTINGS_STORE = 'settings';

const fsrsParametersSchema = z.object({
  request_retention: z.coerce
    .number()
    .min(0.7, 'Must be at least 0.7')
    .max(0.99, 'Must be less than 1.0'),
  maximum_interval: z.coerce.number().int().min(1, 'Must be at least 1 day'),
  w: z.array(z.number()),
});

const fsrs6ParametersSchema = z.object({
  request_retention: z.coerce
    .number()
    .min(0.7, 'Must be at least 0.7')
    .max(0.99, 'Must be less than 1.0'),
  maximum_interval: z.coerce.number().int().min(1, 'Must be at least 1 day'),
  w: z.array(z.number()).length(21),
});

export const srsSettingsSchema = z.object({
  scheduler: z.enum(['fsrs', 'sm2', 'fsrs6']),
  fsrsParameters: fsrsParametersSchema,
  mcqFsrsParameters: fsrsParametersSchema,
  fsrs6Parameters: fsrs6ParametersSchema,
  mcqFsrs6Parameters: fsrs6ParametersSchema,
  // Configurable maturity threshold (days) used for Young/Mature classification across schedulers
  maturityThresholdDays: z.coerce.number().int().min(1, 'Must be at least 1 day').default(21),
  sm2StartingEase: z.coerce.number().min(1.3, 'Must be at least 1.3'),
  sm2MinEasinessFactor: z.coerce.number().min(1.3, 'Must be at least 1.3'),
  sm2EasyBonus: z.coerce.number().min(1, 'Must be at least 1.0'),
  sm2IntervalModifier: z.coerce.number().min(0.1, 'Must be at least 0.1'),
  sm2HardIntervalMultiplier: z.coerce.number().min(1.0, 'Must be at least 1.0'),
  sm2LapsedIntervalMultiplier: z.coerce
    .number()
    .min(0, 'Must be at least 0')
    .max(1, 'Must be 1.0 or less'),
  sm2MaximumInterval: z.coerce.number().int().min(1, 'Must be at least 1 day'),
  sm2GraduatingInterval: z.coerce.number().int().min(1, 'Must be at least 1 day'),
  sm2EasyInterval: z.coerce.number().int().min(1, 'Must be at least 1 day'),
  sm2MinimumInterval: z.coerce.number().int().min(1, 'Must be at least 1 day'),
  learningSteps: z
    .string()
    .regex(
      /^(\d+[smhd]?\s*)*\d+[smhd]?$/,
      'Must be space-separated numbers with optional s,m,h,d units.',
    ),
  relearningSteps: z
    .string()
    .regex(
      /^(\d+[smhd]?\s*)*\d+[smhd]?$/,
      'Must be space-separated numbers with optional s,m,h,d units.',
    ),
  leechThreshold: z.coerce.number().int().min(1, 'Must be at least 1'),
  leechAction: z.enum(['tag', 'suspend']),
  newCardsPerDay: z.coerce.number().int().min(0, 'Must be 0 or greater'),
  maxReviewsPerDay: z.coerce.number().int().min(0, 'Must be 0 or greater'),
  mcqNewCardsPerDay: z.coerce.number().int().min(0, 'Must be 0 or greater'),
  mcqMaxReviewsPerDay: z.coerce.number().int().min(0, 'Must be 0 or greater'),
  // MCQ-specific display/review behavior (new)
  mcqDisplayOrder: z.enum(['sequential', 'random', 'byTag', 'byDifficulty']).default('sequential'),
  mcqNewVsReviewOrder: z.enum(['mix', 'newFirst', 'reviewFirst']).default('mix'),
  mcqReviewSortOrder: z.enum(['dueDate', 'overdueFirst', 'random']).default('dueDate'),
  mcqBurySiblings: z.boolean().default(false),
  mcqInterleaveBanks: z.boolean().default(true),
  mcqShuffleOptions: z.boolean().default(true),
  newCardInsertionOrder: z.enum(['sequential', 'random']),
  newCardGatherOrder: z.enum(['deck', 'ascending', 'descending', 'randomNotes', 'randomCards']),
  newCardSortOrder: z.enum([
    'gathered',
    'typeThenGathered',
    'typeThenRandom',
    'randomNote',
    'random',
  ]),
  newReviewOrder: z.enum(['mix', 'after', 'before']),
  interdayLearningReviewOrder: z.enum(['mix', 'after', 'before']),
  reviewSortOrder: z.enum(['dueDateRandom', 'dueDateDeck', 'overdue']),
  buryNewSiblings: z.boolean(),
  buryReviewSiblings: z.boolean(),
  buryInterdayLearningSiblings: z.boolean(),
  newCardsIgnoreReviewLimit: z.boolean(),
  limitsStartFromTop: z.boolean(),
  disableFlipAnimation: z.boolean(),
  // AI Settings
  geminiApiKey: z.string().optional(),
});

export type SrsSettings = z.infer<typeof srsSettingsSchema>;

interface SettingsDB extends DBSchema {
  [SETTINGS_STORE]: {
    key: string;
    value: SrsSettings;
  };
}

const defaultFsrsParams = generatorParameters();
const defaultFsrs6Weights: number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

const defaultSettings: SrsSettings = {
  scheduler: 'fsrs',
  fsrsParameters: {
    ...defaultFsrsParams,
    w: [...defaultFsrsParams.w],
  },
  mcqFsrsParameters: {
    request_retention: 0.82,
    maximum_interval: 365,
    w: [...defaultFsrsParams.w],
  },
  fsrs6Parameters: {
    request_retention: 0.9,
    maximum_interval: 36500,
    w: defaultFsrs6Weights,
  },
  mcqFsrs6Parameters: {
    request_retention: 0.82,
    maximum_interval: 365,
    w: defaultFsrs6Weights,
  },
  maturityThresholdDays: 21,
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
  learningSteps: '1 10', // in minutes, space-separated
  relearningSteps: '10', // in minutes, space-separated
  leechThreshold: 8,
  leechAction: 'tag',
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  mcqNewCardsPerDay: 20,
  mcqMaxReviewsPerDay: 200,
  mcqDisplayOrder: 'sequential',
  mcqNewVsReviewOrder: 'mix',
  mcqReviewSortOrder: 'dueDate',
  mcqBurySiblings: false,
  mcqInterleaveBanks: true,
  mcqShuffleOptions: true,
  newCardInsertionOrder: 'sequential',
  newCardGatherOrder: 'deck',
  newCardSortOrder: 'typeThenGathered',
  newReviewOrder: 'mix',
  interdayLearningReviewOrder: 'mix',
  reviewSortOrder: 'dueDateRandom',
  buryNewSiblings: false,
  buryReviewSiblings: false,
  buryInterdayLearningSiblings: false,
  newCardsIgnoreReviewLimit: false,
  limitsStartFromTop: false,
  disableFlipAnimation: false,
  // AI Settings
  geminiApiKey: undefined,
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
        console.error('Failed to load settings, falling back to defaults.', error);
        setSettingsState(defaultSettings);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const setSettings = (newSettings: SrsSettings) => {
    setSettingsState(newSettings);
    saveSettingsToDB(newSettings).catch((error) => {
      console.error('Failed to save settings', error);
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
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

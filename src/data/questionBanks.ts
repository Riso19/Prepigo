import * as z from 'zod';
import { srsDataSchema } from './decks';
import { srsSettingsSchema as baseSrsSettingsSchema } from '@/contexts/SettingsContext';

// Define a custom type for srsSettings that ensures maturityThresholdDays is always a number
type SrsSettings = z.infer<typeof baseSrsSettingsSchema> & {
  maturityThresholdDays: number;
};

// Create a custom srsSettings schema
const srsSettingsSchema = baseSrsSettingsSchema.transform(settings => ({
  ...settings,
  maturityThresholdDays: settings.maturityThresholdDays ?? 21 // Ensure it's always a number
})) as z.ZodType<SrsSettings>;

// --- MCQ Schemas ---
export const mcqOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
});

export const mcqDataSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(mcqOptionSchema),
  explanation: z.string(),
  tags: z.array(z.string()).optional(),
  srs: srsDataSchema.optional(),
});

// --- Question Bank Schema (Recursive) ---
const baseQuestionBankSchema = z.object({
  id: z.string(),
  name: z.string(),
  mcqs: z.array(mcqDataSchema),
  hasCustomSettings: z.boolean().optional(),
  srsSettings: srsSettingsSchema.optional().transform(settings => {
    if (!settings) return undefined;
    return {
      ...settings,
      maturityThresholdDays: settings.maturityThresholdDays ?? 21 // Ensure this is always a number
    };
  }),
});

// Define the recursive schema
type QuestionBankDataInternal = z.infer<typeof baseQuestionBankSchema> & {
  subBanks?: QuestionBankDataInternal[];
};

const questionBankDataSchemaInternal: z.ZodType<QuestionBankDataInternal> = baseQuestionBankSchema.extend({
  subBanks: z.lazy(() => z.array(questionBankDataSchemaInternal)).optional(),
});

export const questionBankDataSchema = questionBankDataSchemaInternal;

// Explicit TS interface to avoid any in recursive inference
export interface QuestionBankData {
  id: string;
  name: string;
  mcqs: McqData[];
  hasCustomSettings?: boolean;
  srsSettings?: SrsSettings;
  subBanks?: QuestionBankData[];
}

export type McqOption = z.infer<typeof mcqOptionSchema>;
export type McqData = z.infer<typeof mcqDataSchema>;
export const questionBanksSchema = z.array(questionBankDataSchema);

// --- Initial Data ---
export const questionBanks: QuestionBankData[] = [
  {
    id: "qb1",
    name: "Cardiology MCQs",
    mcqs: [
      {
        id: "mcq1",
        question: "Which of the following is the most common cause of myocardial infarction?",
        options: [
          { id: "opt1-1", text: "Coronary artery embolism", isCorrect: false },
          { id: "opt1-2", text: "Atherosclerosis", isCorrect: true },
          { id: "opt1-3", text: "Coronary artery spasm", isCorrect: false },
          { id: "opt1-4", text: "Aortic dissection", isCorrect: false },
        ],
        explanation: "Atherosclerosis, the buildup of plaques in arteries, is the primary cause of most heart attacks by narrowing the coronary arteries.",
      },
    ],
    subBanks: [
      {
        id: "sqb1-1",
        name: "ECG Interpretation",
        mcqs: [],
        subBanks: [],
      },
    ],
  },
];
import * as z from 'zod';
import { srsDataSchema } from './decks';
import { srsSettingsSchema } from '@/contexts/SettingsContext';

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
  srsSettings: srsSettingsSchema.optional(),
});

export type QuestionBankData = z.infer<typeof baseQuestionBankSchema> & {
  subBanks?: QuestionBankData[];
};

export const questionBankDataSchema: z.ZodType<QuestionBankData> = baseQuestionBankSchema.extend({
  subBanks: z.lazy(() => z.array(questionBankDataSchema)).optional(),
});

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
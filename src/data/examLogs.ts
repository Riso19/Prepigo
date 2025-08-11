import * as z from 'zod';
import { mcqDataSchema } from './questionBanks';

export const examLogEntrySchema = z.object({
  mcq: mcqDataSchema,
  selectedOptionId: z.string().nullable(),
  isCorrect: z.boolean(),
  status: z.enum(['answered', 'skipped', 'marked']),
});

export const examLogSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(), // ISO string
  settings: z.object({
    timeLimit: z.number(), // in minutes
    totalQuestions: z.number(),
    marksPerCorrect: z.number(),
    negativeMarksPerWrong: z.number(),
  }),
  results: z.object({
    score: z.number(),
    correctCount: z.number(),
    incorrectCount: z.number(),
    skippedCount: z.number(),
    timeTaken: z.number(), // in seconds
  }),
  entries: z.array(examLogEntrySchema),
});

export type ExamLogEntry = z.infer<typeof examLogEntrySchema>;
export type ExamLog = z.infer<typeof examLogSchema>;
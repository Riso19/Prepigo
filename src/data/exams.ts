import * as z from 'zod';

export const examScheduleItemSchema = z.object({
  date: z.string(), // ISO date string (yyyy-mm-dd)
  cardIds: z.array(z.string()),
  completedCardIds: z.array(z.string()),
});

export const examDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  examDate: z.string(), // ISO date string
  targetDeckIds: z.array(z.string()),
  targetTags: z.array(z.string()),
  filterMode: z.enum(['all', 'due']),
  studyMode: z.enum(['srs', 'cram']),
  schedule: z.array(examScheduleItemSchema),
});

export type ExamScheduleItem = z.infer<typeof examScheduleItemSchema>;
export type ExamData = z.infer<typeof examDataSchema>;
export const examsSchema = z.array(examDataSchema);
import * as z from 'zod';

export const examDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  examDate: z.string(), // ISO date string
  targetDeckIds: z.array(z.string()),
  targetTags: z.array(z.string()),
  filterMode: z.enum(['all', 'due', 'difficulty']),
  filterDifficultyMin: z.number().optional(),
  filterDifficultyMax: z.number().optional(),
});

export type ExamData = z.infer<typeof examDataSchema>;
export const examsSchema = z.array(examDataSchema);
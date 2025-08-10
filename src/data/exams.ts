import * as z from 'zod';

export const examDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(), // ISO string
  deckIds: z.array(z.string()),
  tags: z.array(z.string()),
  tagFilterType: z.enum(['any', 'all']),
  filterMode: z.enum(['all', 'due', 'difficulty']),
  filterDifficultyMin: z.number().min(1).max(10).optional(),
  filterDifficultyMax: z.number().min(1).max(10).optional(),
});

export type ExamData = z.infer<typeof examDataSchema>;

export const examsSchema = z.array(examDataSchema);
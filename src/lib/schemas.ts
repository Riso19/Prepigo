import { z } from 'zod';

// Common
export const isoDateString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Invalid ISO date string',
});

export const Id = z.string().min(1);

// Resource (DB model: current app expects a PDF resource with mediaId and timestamps)
export const ResourceItemDbSchema = z.object({
  id: Id,
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mediaId: z.string(),
  size: z.number().int().nonnegative().optional(),
  type: z.literal('application/pdf'),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type ResourceItem = z.infer<typeof ResourceItemDbSchema>;

// Deck
export const DeckDataSchema = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});
export type DeckData = z.infer<typeof DeckDataSchema>;

// Exam
export const ExamDataSchema = z.object({
  id: Id,
  name: z.string().min(1),
  date: z.string().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});
export type ExamData = z.infer<typeof ExamDataSchema>;

// Question Bank
export const QuestionBankDataSchema = z.object({
  id: Id,
  name: z.string().min(1),
  updatedAt: z.number().int().nonnegative().optional(),
});
export type QuestionBankData = z.infer<typeof QuestionBankDataSchema>;

// Resource Highlight
export const ResourceHighlightSchema = z.object({
  id: Id,
  resourceId: Id,
  page: z.number().int().nonnegative(),
  color: z.string().min(1),
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});
export type ResourceHighlight = z.infer<typeof ResourceHighlightSchema>;

// Utility validators
export function validate<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`[validate][${context}] ${issues}`);
  }
  return r.data;
}

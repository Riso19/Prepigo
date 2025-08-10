import * as z from 'zod';
import { State } from 'ts-fsrs';
import { srsSettingsSchema } from '@/contexts/SettingsContext';

export type FlashcardType = "basic" | "cloze" | "imageOcclusion";

// --- SRS State Schemas ---

// Schema for FSRS state, aligned with ts-fsrs Card type
const fsrsStateSchema = z.object({
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.nativeEnum(State),
  last_review: z.string().optional(),
  learning_steps: z.number().optional(),
});
export type FsrsState = z.infer<typeof fsrsStateSchema>;

// Schema for SM-2 state
const sm2StateSchema = z.object({
  due: z.string(),
  easinessFactor: z.number(),
  interval: z.number(),
  repetitions: z.number(),
  lapses: z.number().optional(),
  state: z.enum(['new', 'learning', 'review', 'relearning']).optional(),
  last_review: z.string().optional(),
  learning_step: z.number().optional(),
});
export type Sm2State = z.infer<typeof sm2StateSchema>;

// Container for all SRS data for a single card
export const srsDataSchema = z.object({
  fsrs: fsrsStateSchema.optional(),
  fsrs6: fsrsStateSchema.optional(),
  sm2: sm2StateSchema.optional(),
  isSuspended: z.boolean().optional(),
  newCardOrder: z.number().optional(),
});
export type SrsData = z.infer<typeof srsDataSchema>;


// --- Flashcard Schemas ---
const baseFlashcardSchema = z.object({
  id: z.string(),
  noteId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  srs: srsDataSchema.optional(),
});

export const basicFlashcardSchema = baseFlashcardSchema.extend({
  type: z.literal("basic"),
  question: z.string(),
  answer: z.string(),
});

export const clozeFlashcardSchema = baseFlashcardSchema.extend({
  type: z.literal("cloze"),
  text: z.string(),
  description: z.string().optional(),
});

export const occlusionSchema = z.object({
  id: z.number(),
  // All coordinates and dimensions are normalized (0.0 to 1.0) relative to the image size.
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const imageOcclusionFlashcardSchema = baseFlashcardSchema.extend({
  type: z.literal("imageOcclusion"),
  imageUrl: z.string(),
  occlusions: z.array(occlusionSchema),
  questionOcclusionId: z.number(),
  description: z.string().optional(),
  // Adding revealState to track revealed occlusions
  revealState: z.record(z.boolean()).optional(),
});

export const flashcardDataSchema = z.union([
  basicFlashcardSchema,
  clozeFlashcardSchema,
  imageOcclusionFlashcardSchema,
]);

// --- Deck Schema (Recursive) ---
const baseDeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  flashcards: z.array(flashcardDataSchema),
  hasCustomSettings: z.boolean().optional(),
  srsSettings: srsSettingsSchema.optional(),
});

export type DeckData = z.infer<typeof baseDeckSchema> & {
  subDecks?: DeckData[];
};

export const deckDataSchema: z.ZodType<DeckData> = baseDeckSchema.extend({
  subDecks: z.lazy(() => z.array(deckDataSchema)).optional(),
});

// --- Review Log Schema for FSRS, aligned with ts-fsrs ReviewLog type ---
export const reviewLogSchema = z.object({
  cardId: z.string(),
  rating: z.number(),
  state: z.nativeEnum(State),
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  last_elapsed_days: z.number(),
  scheduled_days: z.number(),
  review: z.string(),
  learning_steps: z.number().optional(),
});

// --- Final Schemas for Types and Validation ---
export type BasicFlashcard = z.infer<typeof basicFlashcardSchema>;
export type ClozeFlashcard = z.infer<typeof clozeFlashcardSchema>;
export type Occlusion = z.infer<typeof occlusionSchema>;
export type ImageOcclusionFlashcard = z.infer<typeof imageOcclusionFlashcardSchema>;
export type FlashcardData = z.infer<typeof flashcardDataSchema>;
export type ReviewLog = z.infer<typeof reviewLogSchema>;
export const decksSchema = z.array(deckDataSchema);


// --- Initial Data ---
export const decks: DeckData[] = [
  {
    id: "d1",
    name: "Cardiology",
    flashcards: [
      { id: "f1", noteId: "n1", type: "basic", question: "What is the medical term for a heart attack?", answer: "Myocardial Infarction" },
      { id: "f6", noteId: "n2", type: "basic", question: "What does ECG stand for?", answer: "Electrocardiogram" },
    ],
    subDecks: [
      {
        id: "sd1-1",
        name: "Anatomy of the Heart",
        flashcards: [
          { id: "f7", noteId: "n3", type: "basic", question: "How many chambers does the human heart have?", answer: "Four" },
          { id: "f8", noteId: "n4", type: "basic", question: "What is the main artery leaving the heart?", answer: "Aorta" },
        ],
        subDecks: [
            {
                id: "sd1-1-1",
                name: "Heart Valves",
                flashcards: [
                    { id: "f9", noteId: "n5", type: "basic", question: "Name the four valves of the heart.", answer: "Tricuspid, Pulmonary, Mitral, Aortic" },
                ],
            }
        ]
      },
    ],
  },
  {
    id: "d2",
    name: "Neurology",
    flashcards: [
      { id: "f4", noteId: "n6", type: "basic", question: "What part of the brain is responsible for balance and coordination?", answer: "The Cerebellum" },
    ],
    subDecks: [],
  },
  {
    id: "d3",
    name: "General Medicine",
    flashcards: [
      { id: "f2", noteId: "n7", type: "basic", question: "Which bone is the longest in the human body?", answer: "The Femur (thigh bone)" },
      { id: "f3", noteId: "n8", type: "basic", question: "What are the four main blood types?", answer: "A, B, AB, and O" },
      { id: "f5", noteId: "n9", type: "basic", question: "What is the function of the kidneys?", answer: "To filter blood and produce urine" },
    ],
  },
];
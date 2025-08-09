import * as z from 'zod';

export type FlashcardType = "basic" | "cloze" | "imageOcclusion";

// --- Base SRS fields for all card types ---
const srsSchema = z.object({
  repetitions: z.number().optional(),
  easeFactor: z.number().optional(),
  interval: z.number().optional(),
  nextReviewDate: z.string().optional(),
  lapses: z.number().optional(),
  isSuspended: z.boolean().optional(),
});

// --- Flashcard Schemas ---
export const basicFlashcardSchema = z.object({
  id: z.string(),
  type: z.literal("basic"),
  question: z.string(),
  answer: z.string(),
}).merge(srsSchema);

export const clozeFlashcardSchema = z.object({
  id: z.string(),
  type: z.literal("cloze"),
  text: z.string(),
  description: z.string().optional(),
}).merge(srsSchema);

export const occlusionSchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const imageOcclusionFlashcardSchema = z.object({
  id: z.string(),
  type: z.literal("imageOcclusion"),
  imageUrl: z.string(),
  occlusions: z.array(occlusionSchema),
  questionOcclusionId: z.number(),
  description: z.string().optional(),
}).merge(srsSchema);

export const flashcardDataSchema = z.union([
  basicFlashcardSchema,
  clozeFlashcardSchema,
  imageOcclusionFlashcardSchema,
]);

// --- Deck Schema (Recursive) ---
// Define a base schema for a deck's non-recursive properties.
const baseDeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  flashcards: z.array(flashcardDataSchema),
});

// Define and export the recursive DeckData type.
export type DeckData = z.infer<typeof baseDeckSchema> & {
  subDecks?: DeckData[];
};

// Now, create the schema that validates the recursive type.
export const deckDataSchema: z.ZodType<DeckData> = baseDeckSchema.extend({
  subDecks: z.lazy(() => z.array(deckDataSchema)).optional(),
});

// --- Final Schemas for Types and Validation ---
export type BasicFlashcard = z.infer<typeof basicFlashcardSchema>;
export type ClozeFlashcard = z.infer<typeof clozeFlashcardSchema>;
export type Occlusion = z.infer<typeof occlusionSchema>;
export type ImageOcclusionFlashcard = z.infer<typeof imageOcclusionFlashcardSchema>;
export type FlashcardData = z.infer<typeof flashcardDataSchema>;
export const decksSchema = z.array(deckDataSchema);


// --- Initial Data ---
export const decks: DeckData[] = [
  {
    id: "d1",
    name: "Cardiology",
    flashcards: [
      { id: "f1", type: "basic", question: "What is the medical term for a heart attack?", answer: "Myocardial Infarction" },
      { id: "f6", type: "basic", question: "What does ECG stand for?", answer: "Electrocardiogram" },
    ],
    subDecks: [
      {
        id: "sd1-1",
        name: "Anatomy of the Heart",
        flashcards: [
          { id: "f7", type: "basic", question: "How many chambers does the human heart have?", answer: "Four" },
          { id: "f8", type: "basic", question: "What is the main artery leaving the heart?", answer: "Aorta" },
        ],
        subDecks: [
            {
                id: "sd1-1-1",
                name: "Heart Valves",
                flashcards: [
                    { id: "f9", type: "basic", question: "Name the four valves of the heart.", answer: "Tricuspid, Pulmonary, Mitral, Aortic" },
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
      { id: "f4", type: "basic", question: "What part of the brain is responsible for balance and coordination?", answer: "The Cerebellum" },
    ],
    subDecks: [],
  },
  {
    id: "d3",
    name: "General Medicine",
    flashcards: [
      { id: "f2", type: "basic", question: "Which bone is the longest in the human body?", answer: "The Femur (thigh bone)" },
      { id: "f3", type: "basic", question: "What are the four main blood types?", answer: "A, B, AB, and O" },
      { id: "f5", type: "basic", question: "What is the function of the kidneys?", answer: "To filter blood and produce urine" },
    ],
  },
];
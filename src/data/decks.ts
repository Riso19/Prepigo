export type FlashcardType = "basic" | "cloze" | "imageOcclusion";

export interface BasicFlashcard {
  id: string;
  type: "basic";
  question: string;
  answer: string;
}

export interface ClozeFlashcard {
  id: string;
  type: "cloze";
  text: string;
}

export interface Occlusion {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageOcclusionFlashcard {
  id: string;
  type: "imageOcclusion";
  imageUrl: string; // base64
  occlusions: Occlusion[];
  questionOcclusionId: number; // The id of the occlusion to be guessed
}

export type FlashcardData = BasicFlashcard | ClozeFlashcard | ImageOcclusionFlashcard;

export interface DeckData {
  id: string;
  name: string;
  flashcards: FlashcardData[];
  subDecks?: DeckData[];
}

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
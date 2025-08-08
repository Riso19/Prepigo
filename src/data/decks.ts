export interface FlashcardData {
  id: number;
  question: string;
  answer: string;
}

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
      { id: 1, question: "What is the medical term for a heart attack?", answer: "Myocardial Infarction" },
      { id: 6, question: "What does ECG stand for?", answer: "Electrocardiogram" },
    ],
    subDecks: [
      {
        id: "sd1-1",
        name: "Anatomy of the Heart",
        flashcards: [
          { id: 7, question: "How many chambers does the human heart have?", answer: "Four" },
          { id: 8, question: "What is the main artery leaving the heart?", answer: "Aorta" },
        ],
        subDecks: [
            {
                id: "sd1-1-1",
                name: "Heart Valves",
                flashcards: [
                    { id: 9, question: "Name the four valves of the heart.", answer: "Tricuspid, Pulmonary, Mitral, Aortic" },
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
      { id: 4, question: "What part of the brain is responsible for balance and coordination?", answer: "The Cerebellum" },
    ],
    subDecks: [],
  },
  {
    id: "d3",
    name: "General Medicine",
    flashcards: [
      { id: 2, question: "Which bone is the longest in the human body?", answer: "The Femur (thigh bone)" },
      { id: 3, question: "What are the four main blood types?", answer: "A, B, AB, and O" },
      { id: 5, question: "What is the function of the kidneys?", answer: "To filter blood and produce urine" },
    ],
  },
];
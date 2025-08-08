export interface FlashcardData {
  id: number;
  question: string;
  answer: string;
}

export const medicalFlashcards: FlashcardData[] = [
  {
    id: 1,
    question: "What is the medical term for a heart attack?",
    answer: "Myocardial Infarction",
  },
  {
    id: 2,
    question: "Which bone is the longest in the human body?",
    answer: "The Femur (thigh bone)",
  },
  {
    id: 3,
    question: "What are the four main blood types?",
    answer: "A, B, AB, and O",
  },
  {
    id: 4,
    question: "What part of the brain is responsible for balance and coordination?",
    answer: "The Cerebellum",
  },
  {
    id: 5,
    question: "What is the function of the kidneys?",
    answer: "To filter blood and produce urine",
  },
];
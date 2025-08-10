import { ExamData } from "@/data/exams";
import { DeckData, FlashcardData } from "@/data/decks";
import { getAllFlashcardsFromDeck } from "./card-utils";
import { State } from "ts-fsrs";
import { SrsSettings } from "@/contexts/SettingsContext";

export const getCardsForExam = (exam: ExamData, allDecks: DeckData[], settings: SrsSettings): FlashcardData[] => {
  const allDecksFlat = (d: DeckData[]): DeckData[] => d.flatMap(deck => [deck, ...(deck.subDecks ? allDecksFlat(deck.subDecks) : [])]);
  const flatDecks = allDecksFlat(allDecks);

  const cardSet = new Set<FlashcardData>();
  const targetDeckIds = new Set(exam.deckIds || []);

  flatDecks.forEach(deck => {
    if (targetDeckIds.has(deck.id)) {
      getAllFlashcardsFromDeck(deck).forEach(card => cardSet.add(card));
    }
  });

  let cards = Array.from(cardSet);

  if (exam.tags && exam.tags.length > 0) {
    cards = cards.filter(card => {
      if (!card.tags || card.tags.length === 0) return false;
      if (exam.tagFilterType === 'any') {
        return exam.tags.some(tag => card.tags!.includes(tag));
      } else {
        return exam.tags.every(tag => card.tags!.includes(tag));
      }
    });
  }

  const now = new Date();
  switch (exam.filterMode) {
    case 'due':
      cards = cards.filter(c => {
        const srsData = settings.scheduler === 'fsrs6' ? c.srs?.fsrs6 : c.srs?.fsrs;
        return !!srsData && new Date(srsData.due) <= now;
      });
      break;
    case 'difficulty':
      if (exam.filterDifficultyMin !== undefined && exam.filterDifficultyMax !== undefined) {
        cards = cards.filter(c => {
          const srsData = settings.scheduler === 'fsrs6' ? c.srs?.fsrs6 : c.srs?.fsrs;
          if (!srsData || srsData.state === State.New) return false;
          const difficulty = srsData.difficulty;
          return difficulty >= exam.filterDifficultyMin! && difficulty <= exam.filterDifficultyMax!;
        });
      }
      break;
    case 'all':
    default:
      break;
  }

  return cards;
};

export const calculateExamProgress = (exam: ExamData, cardsInScope: FlashcardData[], settings: SrsSettings): { mastered: number, total: number, percentage: number } => {
  if (cardsInScope.length === 0) {
    return { mastered: 0, total: 0, percentage: 100 };
  }

  const examDate = new Date(exam.date);
  const masteredCount = cardsInScope.filter(card => {
    const srsData = settings.scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
    if (!srsData) return false;
    const dueDate = new Date(srsData.due);
    return dueDate > examDate;
  }).length;

  return {
    mastered: masteredCount,
    total: cardsInScope.length,
    percentage: Math.round((masteredCount / cardsInScope.length) * 100),
  };
};
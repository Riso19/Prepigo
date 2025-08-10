import { ExamData } from "@/data/exams";
import { DeckData, FlashcardData } from "@/data/decks";
import { getAllFlashcardsFromDeck } from "./card-utils";
import { State } from "ts-fsrs";
import { SrsSettings } from "@/contexts/SettingsContext";
import { McqData, QuestionBankData } from "@/data/questionBanks";
import { getAllMcqsFromBank } from "./question-bank-utils";

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

export const getMcqsForExam = (exam: ExamData, allQuestionBanks: QuestionBankData[], settings: SrsSettings): McqData[] => {
  const allBanksFlat = (b: QuestionBankData[]): QuestionBankData[] => b.flatMap(bank => [bank, ...(bank.subBanks ? allBanksFlat(bank.subBanks) : [])]);
  const flatBanks = allBanksFlat(allQuestionBanks);

  const mcqSet = new Set<McqData>();
  const targetBankIds = new Set(exam.questionBankIds || []);

  flatBanks.forEach(bank => {
    if (targetBankIds.has(bank.id)) {
      getAllMcqsFromBank(bank).forEach(mcq => mcqSet.add(mcq));
    }
  });

  let mcqs = Array.from(mcqSet);

  if (exam.tags && exam.tags.length > 0) {
    mcqs = mcqs.filter(mcq => {
      if (!mcq.tags || mcq.tags.length === 0) return false;
      if (exam.tagFilterType === 'any') {
        return exam.tags.some(tag => mcq.tags!.includes(tag));
      } else {
        return exam.tags.every(tag => mcq.tags!.includes(tag));
      }
    });
  }

  const now = new Date();
  const scheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;
  switch (exam.filterMode) {
    case 'due':
      mcqs = mcqs.filter(m => {
        const srsData = scheduler === 'fsrs6' ? m.srs?.fsrs6 : m.srs?.fsrs;
        return !!srsData && new Date(srsData.due) <= now;
      });
      break;
    case 'difficulty':
      if (exam.filterDifficultyMin !== undefined && exam.filterDifficultyMax !== undefined) {
        mcqs = mcqs.filter(m => {
          const srsData = scheduler === 'fsrs6' ? m.srs?.fsrs6 : m.srs?.fsrs;
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

  return mcqs;
};

export const calculateExamProgress = (exam: ExamData, itemsInScope: (FlashcardData | McqData)[], settings: SrsSettings): { mastered: number, total: number, percentage: number } => {
  if (itemsInScope.length === 0) {
    return { mastered: 0, total: 0, percentage: 100 };
  }

  const examDate = new Date(exam.date);
  const masteredCount = itemsInScope.filter(item => {
    const scheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;
    const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
    if (!srsData) return false;
    const dueDate = new Date(srsData.due);
    return dueDate > examDate;
  }).length;

  return {
    mastered: masteredCount,
    total: itemsInScope.length,
    percentage: Math.round((masteredCount / itemsInScope.length) * 100),
  };
};
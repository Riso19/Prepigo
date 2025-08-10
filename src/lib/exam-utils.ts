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

export const calculateExamProgress = (
  exam: ExamData,
  itemsInScope: (FlashcardData | McqData)[],
  settings: SrsSettings
): {
  mastered: number;
  inProgress: number;
  newItems: number;
  total: number;
  percentage: number;
} => {
  const total = itemsInScope.length;
  if (total === 0) {
    return { mastered: 0, inProgress: 0, newItems: 0, total: 0, percentage: 100 };
  }

  const examDate = new Date(exam.date);
  let masteredCount = 0;
  let inProgressCount = 0;
  let newItemsCount = 0;

  for (const item of itemsInScope) {
    const scheduler = settings.scheduler;
    let isNew = true;
    let dueDate: Date | null = null;

    if (scheduler === 'sm2') {
      const sm2State = item.srs?.sm2;
      if (sm2State && sm2State.state !== 'new' && sm2State.state) {
        isNew = false;
        dueDate = new Date(sm2State.due);
      }
    } else { // fsrs or fsrs6
      const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
      if (srsData && srsData.state !== State.New) {
        isNew = false;
        dueDate = new Date(srsData.due);
      }
    }

    if (isNew) {
      newItemsCount++;
    } else if (dueDate && dueDate > examDate) {
      masteredCount++;
    } else {
      inProgressCount++;
    }
  }
  
  // Give half credit for items in progress
  const weightedProgress = masteredCount + inProgressCount * 0.5;
  const percentage = total > 0 ? Math.round((weightedProgress / total) * 100) : 100;

  return {
    mastered: masteredCount,
    inProgress: inProgressCount,
    newItems: newItemsCount,
    total: total,
    percentage: percentage,
  };
};
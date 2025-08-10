import { ExamData } from "@/data/exams";
import { DeckData, FlashcardData } from "@/data/decks";
import { getAllFlashcardsFromDeck } from "./card-utils";
import { State } from "ts-fsrs";
import { SrsSettings } from "@/contexts/SettingsContext";
import { McqData, QuestionBankData } from "@/data/questionBanks";
import { getAllMcqsFromBank } from "./question-bank-utils";
import { getItemStatus, ItemStatus } from "./srs-utils";
import { differenceInDays } from "date-fns";
import { calculateAverageRetention } from "./analytics-utils";

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
  let weightedScore = 0;
  let masteredCount = 0;
  let inProgressCount = 0;
  let newItemsCount = 0;

  const statusWeights: Record<string, number> = {
    "Mastered": 1.0,
    "Mature": 0.8,
    "Young": 0.6,
    "Learning": 0.3,
    "Relearning": 0.3,
    "New": 0.0,
    "Suspended": 0.0,
  };

  for (const item of itemsInScope) {
    const scheduler = settings.scheduler;
    const status = getItemStatus(item, scheduler);
    
    let dueDate: Date | null = null;
    if (scheduler === 'sm2' && 'question' in item) {
        dueDate = item.srs?.sm2 ? new Date(item.srs.sm2.due) : null;
    } else {
        const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
        dueDate = srsData ? new Date(srsData.due) : null;
    }

    if (status === 'New' || status === 'Suspended') {
        newItemsCount++;
        weightedScore += statusWeights.New;
    } else if (dueDate && dueDate > examDate) {
        masteredCount++;
        weightedScore += statusWeights.Mastered;
    } else {
        inProgressCount++;
        weightedScore += statusWeights[status];
    }
  }
  
  const percentage = total > 0 ? Math.round((weightedScore / total) * 100) : 100;

  return {
    mastered: masteredCount,
    inProgress: inProgressCount,
    newItems: newItemsCount,
    total: total,
    percentage: percentage,
  };
};

export const calculateProjectedRetention = (
  exam: ExamData,
  itemsInScope: (FlashcardData | McqData)[],
  settings: SrsSettings
): number | null => {
  if (itemsInScope.length === 0) return 100;

  const examDate = new Date(exam.date);
  const now = new Date();
  const daysUntilExam = differenceInDays(examDate, now);

  if (daysUntilExam < 0) return null; // Exam has passed

  if (daysUntilExam === 0) {
    const avgRetention = calculateAverageRetention(itemsInScope, settings);
    return avgRetention === null ? null : avgRetention;
  }

  const scheduler = settings.scheduler;
  if (scheduler === 'sm2') return null;

  const w = scheduler === 'fsrs6' ? settings.fsrs6Parameters.w : settings.fsrsParameters.w;
  const factor = Math.pow(0.9, -1 / w[20]) - 1;
  const retrievability = (t: number, s: number): number => Math.pow(1 + factor * t / s, -w[20]);

  const projectedRetentionSum = itemsInScope.reduce((sum, item) => {
      const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
      if (srsData && srsData.state === State.Review) {
          return sum + retrievability(daysUntilExam, srsData.stability);
      }
      // New/learning cards contribute 0 to projected retention if not reviewed
      return sum;
  }, 0);

  return (projectedRetentionSum / itemsInScope.length) * 100;
};
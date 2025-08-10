import { QuestionBankData, McqData } from "@/data/questionBanks";
import { SrsSettings } from "@/contexts/SettingsContext";
import { State } from "ts-fsrs";
import { ExamData } from "@/data/exams";
import { getMcqsForExam } from "./exam-utils";
import { differenceInDays } from "date-fns";

// Recursively find a question bank by its ID
export const findQuestionBankById = (banks: QuestionBankData[], id: string): QuestionBankData | null => {
  for (const bank of banks) {
    if (bank.id === id) return bank;
    if (bank.subBanks) {
      const found = findQuestionBankById(bank.subBanks, id);
      if (found) return found;
    }
  }
  return null;
};

// Recursively find the path of a bank by its ID
export const findQuestionBankPathById = (banks: QuestionBankData[], bankId: string, currentPath: string[] = []): string[] | null => {
  for (const bank of banks) {
    const newPath = [...currentPath, bank.name];
    if (bank.id === bankId) {
      return newPath;
    }
    if (bank.subBanks) {
      const foundPath = findQuestionBankPathById(bank.subBanks, bankId, newPath);
      if (foundPath) {
        return foundPath;
      }
    }
  }
  return null;
};

// Recursively get all MCQs from a bank and its sub-banks
export const getAllMcqsFromBank = (bank: QuestionBankData): McqData[] => {
  let mcqs = [...bank.mcqs];
  if (bank.subBanks) {
    for (const subBank of bank.subBanks) {
      mcqs = [...mcqs, ...getAllMcqsFromBank(subBank)];
    }
  }
  return mcqs;
};

// Immutably add a sub-bank to a parent bank
export const addSubBankToBank = (banks: QuestionBankData[], parentId: string, newSubBank: QuestionBankData): QuestionBankData[] => {
  return banks.map(bank => {
    if (bank.id === parentId) {
      return { ...bank, subBanks: [...(bank.subBanks || []), newSubBank] };
    }
    if (bank.subBanks) {
      return { ...bank, subBanks: addSubBankToBank(bank.subBanks, parentId, newSubBank) };
    }
    return bank;
  });
};

// Immutably add an MCQ to a parent bank
export const addMcqToBank = (banks: QuestionBankData[], parentId: string, newMcq: McqData): QuestionBankData[] => {
    return banks.map(bank => {
        if (bank.id === parentId) {
            return { ...bank, mcqs: [...bank.mcqs, newMcq] };
        }
        if (bank.subBanks) {
            return { ...bank, subBanks: addMcqToBank(bank.subBanks, parentId, newMcq) };
        }
        return bank;
    });
}

// Find an MCQ by its ID across all banks
export const findMcqById = (banks: QuestionBankData[], mcqId: string): { mcq: McqData, bankId: string } | null => {
  for (const bank of banks) {
    const mcq = bank.mcqs.find(m => m.id === mcqId);
    if (mcq) {
      return { mcq, bankId: bank.id };
    }
    if (bank.subBanks) {
      const found = findMcqById(bank.subBanks, mcqId);
      if (found) return found;
    }
  }
  return null;
};

// Immutably update an MCQ in any bank/sub-bank
export const updateMcq = (banks: QuestionBankData[], updatedMcq: McqData): QuestionBankData[] => {
  return banks.map(bank => {
    const mcqIndex = bank.mcqs.findIndex(m => m.id === updatedMcq.id);
    
    let newMcqs = bank.mcqs;
    if (mcqIndex > -1) {
      newMcqs = [
        ...bank.mcqs.slice(0, mcqIndex),
        updatedMcq,
        ...bank.mcqs.slice(mcqIndex + 1),
      ];
    }

    let newSubBanks = bank.subBanks;
    if (bank.subBanks) {
      newSubBanks = updateMcq(bank.subBanks, updatedMcq);
    }

    return { ...bank, mcqs: newMcqs, subBanks: newSubBanks };
  });
};

// Immutably delete an MCQ from any bank/sub-bank
export const deleteMcq = (banks: QuestionBankData[], mcqId: string): QuestionBankData[] => {
  return banks.map(bank => {
    const newMcqs = bank.mcqs.filter(m => m.id !== mcqId);
    
    let newSubBanks = bank.subBanks;
    if (bank.subBanks) {
      newSubBanks = deleteMcq(bank.subBanks, mcqId);
    }

    return { ...bank, mcqs: newMcqs, subBanks: newSubBanks };
  });
};

// Immutably delete a question bank from the hierarchy
export const deleteQuestionBank = (banks: QuestionBankData[], bankIdToDelete: string): QuestionBankData[] => {
  const newBanks = banks.filter(bank => bank.id !== bankIdToDelete);

  return newBanks.map(bank => {
    if (bank.subBanks) {
      return { ...bank, subBanks: deleteQuestionBank(bank.subBanks, bankIdToDelete) };
    }
    return bank;
  });
};

// Immutably move a question bank
export const moveQuestionBank = (banks: QuestionBankData[], activeId: string, overId: string | null): QuestionBankData[] => {
  const banksCopy = JSON.parse(JSON.stringify(banks));

  const findAndSplice = (currentBanks: QuestionBankData[]): QuestionBankData | null => {
    for (let i = 0; i < currentBanks.length; i++) {
      if (currentBanks[i].id === activeId) {
        const [bankToMove] = currentBanks.splice(i, 1);
        return bankToMove;
      }
      if (currentBanks[i].subBanks) {
        const found = findAndSplice(currentBanks[i].subBanks!);
        if (found) return found;
      }
    }
    return null;
  };

  const bankToMove = findAndSplice(banksCopy);

  if (!bankToMove) {
    return banks;
  }

  if (overId === 'root-droppable-qb' || overId === null) {
    banksCopy.push(bankToMove);
  } else {
    const overBank = findQuestionBankById(banksCopy, overId);
    if (overBank) {
      if (findQuestionBankById([bankToMove], overId)) {
        return banks;
      }
      if (!overBank.subBanks) {
        overBank.subBanks = [];
      }
      overBank.subBanks.push(bankToMove);
    } else {
      return banks;
    }
  }

  return banksCopy;
};

// Get all unique tags from all question banks
export const getAllTagsFromQuestionBanks = (banks: QuestionBankData[]): string[] => {
    const allTags = new Set<string>();
    const collectTags = (bank: QuestionBankData) => {
        bank.mcqs.forEach(mcq => {
            mcq.tags?.forEach(tag => allTags.add(tag));
        });
        bank.subBanks?.forEach(collectTags);
    };
    banks.forEach(collectTags);
    return Array.from(allTags).sort((a, b) => a.localeCompare(b));
};

const shuffle = <T,>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const findQuestionBankWithAncestors = (
  banks: QuestionBankData[],
  bankId: string,
  ancestors: QuestionBankData[] = []
): { bank: QuestionBankData; ancestors: QuestionBankData[] } | null => {
  for (const bank of banks) {
    if (bank.id === bankId) {
      return { bank, ancestors };
    }
    if (bank.subBanks) {
      const found = findQuestionBankWithAncestors(bank.subBanks, bankId, [...ancestors, bank]);
      if (found) return found;
    }
  }
  return null;
};

export const getEffectiveMcqSrsSettingsWithSource = (
  banks: QuestionBankData[],
  bankId: string,
  globalSettings: SrsSettings
): { settings: SrsSettings; sourceName: string } => {
  const result = findQuestionBankWithAncestors(banks, bankId);
  if (!result) return { settings: globalSettings, sourceName: 'Global' };

  const { bank, ancestors } = result;
  const hierarchy = [...ancestors, bank];

  for (let i = hierarchy.length - 1; i >= 0; i--) {
    const currentBank = hierarchy[i];
    if (currentBank.hasCustomSettings && currentBank.srsSettings) {
      return { settings: currentBank.srsSettings, sourceName: currentBank.name };
    }
  }

  return { settings: globalSettings, sourceName: 'Global' };
};

export const getEffectiveMcqSrsSettings = (
  banks: QuestionBankData[],
  bankId: string,
  globalSettings: SrsSettings
): SrsSettings => {
  return getEffectiveMcqSrsSettingsWithSource(banks, bankId, globalSettings).settings;
};

export const updateQuestionBank = (banks: QuestionBankData[], updatedBank: QuestionBankData): QuestionBankData[] => {
  return banks.map(bank => {
    if (bank.id === updatedBank.id) {
      return updatedBank;
    }
    if (bank.subBanks) {
      return { ...bank, subBanks: updateQuestionBank(bank.subBanks, updatedBank) };
    }
    return bank;
  });
};

export const getMcqDueCounts = (
  bank: QuestionBankData,
  allBanks: QuestionBankData[],
  globalSettings: SrsSettings
): { newCount: number; learnCount: number; dueCount: number } => {
  const now = new Date();
  let counts = { newCount: 0, learnCount: 0, dueCount: 0 };

  const settings = getEffectiveMcqSrsSettings(allBanks, bank.id, globalSettings);
  const scheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;

  for (const mcq of bank.mcqs) {
    if (mcq.srs?.isSuspended) continue;

    const srsData = scheduler === 'fsrs6' ? mcq.srs?.fsrs6 : mcq.srs?.fsrs;
    const isCardNew = !srsData || srsData.state === State.New;
    const isCardDue = !!srsData && new Date(srsData.due) <= now;
    
    if (isCardNew) {
      counts.newCount++;
      continue;
    }

    if (isCardDue) {
      const isCardLearning = srsData.state === State.Learning || srsData.state === State.Relearning;
      if (isCardLearning) {
        counts.learnCount++;
      } else {
        counts.dueCount++;
      }
    }
  }

  if (bank.subBanks) {
    for (const subBank of bank.subBanks) {
      const subCounts = getMcqDueCounts(subBank, allBanks, globalSettings);
      counts.newCount += subCounts.newCount;
      counts.learnCount += subCounts.learnCount;
      counts.dueCount += subCounts.dueCount;
    }
  }

  return counts;
};

export const buildMcqSessionQueue = (
  banksToStudy: QuestionBankData[],
  allBanks: QuestionBankData[],
  globalSettings: SrsSettings,
  introducedMcqIds: Set<string>,
  exams?: ExamData[]
): { queue: McqData[], mcqExamMap: Map<string, ExamData> } => {
  const now = new Date();
  const mcqExamMap = new Map<string, ExamData>();
  const examPriorityNew: McqData[] = [];
  const examPriorityMcqIds = new Set<string>();

  const isTrulyNew = (mcq: McqData, s: SrsSettings) => {
    if (mcq.srs?.isSuspended) return false;
    const scheduler = s.scheduler === 'sm2' ? 'fsrs' : s.scheduler;
    const srsData = scheduler === 'fsrs6' ? mcq.srs?.fsrs6 : mcq.srs?.fsrs;
    return !srsData || srsData.state === State.New;
  };

  if (exams && exams.length > 0) {
    const sortedExams = [...exams].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const exam of sortedExams) {
      const allMcqsForExam = getMcqsForExam(exam, allBanks, globalSettings);
      for (const mcq of allMcqsForExam) {
        if (!mcqExamMap.has(mcq.id)) {
          mcqExamMap.set(mcq.id, exam);
        }
      }

      const totalNewPoolForExam = allMcqsForExam.filter(mcq => 
        isTrulyNew(mcq, globalSettings) || introducedMcqIds.has(mcq.id)
      );

      const newIntroducedForThisExamToday = allMcqsForExam.filter(mcq => introducedMcqIds.has(mcq.id)).length;
      const availableNewMcqsForExam = allMcqsForExam.filter(mcq => isTrulyNew(mcq, globalSettings) && !introducedMcqIds.has(mcq.id));

      const daysLeft = differenceInDays(new Date(exam.date), now);
      let dailyBudget: number;

      if (daysLeft <= 0) {
        dailyBudget = availableNewMcqsForExam.length;
      } else {
        dailyBudget = Math.ceil(totalNewPoolForExam.length / daysLeft);
      }

      const newForToday = Math.max(0, dailyBudget - newIntroducedForThisExamToday);

      const mcqsForToday = availableNewMcqsForExam.slice(0, newForToday);
      mcqsForToday.forEach(mcq => {
        if (!examPriorityMcqIds.has(mcq.id)) {
          examPriorityNew.push(mcq);
          examPriorityMcqIds.add(mcq.id);
        }
      });
    }
  }

  const examSort = (a: McqData, b: McqData): number => {
    const examA = mcqExamMap.get(a.id);
    const examB = mcqExamMap.get(b.id);
    if (examA && !examB) return -1;
    if (!examA && examB) return 1;
    if (examA && examB) {
        const diff = new Date(examA.date).getTime() - new Date(examB.date).getTime();
        if (diff !== 0) return diff;
    }
    return 0;
  };

  const isNew = (mcq: McqData, s: SrsSettings) => {
    if (examPriorityMcqIds.has(mcq.id)) return false;
    if (introducedMcqIds.has(mcq.id)) return false;
    return isTrulyNew(mcq, s);
  };

  const isDue = (mcq: McqData, s: SrsSettings) => {
    if (mcq.srs?.isSuspended) return false;
    const scheduler = s.scheduler === 'sm2' ? 'fsrs' : s.scheduler;
    const srsData = scheduler === 'fsrs6' ? mcq.srs?.fsrs6 : mcq.srs?.fsrs;
    return !!srsData && new Date(srsData.due) <= now;
  };

  const isLearning = (mcq: McqData, s: SrsSettings) => {
    if (!isDue(mcq, s)) return false;
    const scheduler = s.scheduler === 'sm2' ? 'fsrs' : s.scheduler;
    const srsData = scheduler === 'fsrs6' ? mcq.srs?.fsrs6 : mcq.srs?.fsrs;
    return !!srsData && (srsData.state === State.Learning || srsData.state === State.Relearning);
  };

  const sessionNew: McqData[] = [];
  const sessionReviews: McqData[] = [];
  const sessionLearning: McqData[] = [];

  const recursiveGather = (bank: QuestionBankData, newBudget: number, reviewBudget: number): { newTaken: number, reviewsTaken: number } => {
    const settings = getEffectiveMcqSrsSettings(allBanks, bank.id, globalSettings);
    const currentNewBudget = Math.min(newBudget, settings.mcqNewCardsPerDay);
    const currentReviewBudget = Math.min(reviewBudget, settings.mcqMaxReviewsPerDay);
    let newTaken = 0;
    let reviewsTaken = 0;

    const mcqs = bank.mcqs;
    sessionLearning.push(...mcqs.filter(m => isLearning(m, settings)));
    
    const potentialReviews = mcqs.filter(m => isDue(m, settings) && !isLearning(m, settings));
    const reviewsToTake = Math.min(potentialReviews.length, currentReviewBudget);
    if (reviewsToTake > 0) {
      sessionReviews.push(...potentialReviews.slice(0, reviewsToTake));
      reviewsTaken += reviewsToTake;
    }

    const canTakeNew = globalSettings.newCardsIgnoreReviewLimit || reviewsTaken < currentReviewBudget;
    if (canTakeNew) {
      const potentialNew = mcqs.filter(m => isNew(m, settings));
      const newToTake = Math.min(potentialNew.length, currentNewBudget);
      if (newToTake > 0) {
        sessionNew.push(...potentialNew.slice(0, newToTake));
        newTaken += newToTake;
      }
    }

    if (bank.subBanks) {
      for (const subBank of bank.subBanks) {
        const remainingNew = newBudget - newTaken;
        const remainingReview = reviewBudget - reviewsTaken;
        if (remainingNew <= 0 && remainingReview <= 0) break;
        const { newTaken: subNew, reviewsTaken: subReviews } = recursiveGather(subBank, remainingNew, remainingReview);
        newTaken += subNew;
        reviewsTaken += subReviews;
      }
    }
    return { newTaken, reviewsTaken };
  };

  let remainingNewBudget = Math.max(0, globalSettings.mcqNewCardsPerDay - introducedMcqIds.size);
  let remainingReviewBudget = globalSettings.mcqMaxReviewsPerDay;

  for (const bank of banksToStudy) {
    if (remainingNewBudget <= 0 && remainingReviewBudget <= 0 && !globalSettings.newCardsIgnoreReviewLimit) {
      break;
    }
    
    const { newTaken, reviewsTaken } = recursiveGather(bank, remainingNewBudget, remainingReviewBudget);
    
    remainingNewBudget -= newTaken;
    remainingReviewBudget -= reviewsTaken;
  }

  const sortedNew = shuffle([...new Set(sessionNew)]);
  const sortedReviews = shuffle([...new Set(sessionReviews)]);
  const learningCombined = [...new Set(sessionLearning)].sort((a, b) => {
      const srsA = a.srs?.fsrs || a.srs?.fsrs6;
      const srsB = b.srs?.fsrs || b.srs?.fsrs6;
      return new Date(srsA!.due).getTime() - new Date(srsB!.due).getTime();
  });

  examPriorityNew.sort(examSort);
  const finalQueue = [...examPriorityNew, ...learningCombined, ...shuffle([...sortedReviews, ...sortedNew])];

  return { queue: finalQueue, mcqExamMap };
};

// Immutably merge new question banks into existing ones
export const mergeQuestionBanks = (existingBanks: QuestionBankData[], newBanks: QuestionBankData[]): QuestionBankData[] => {
  const bankMap = new Map<string, QuestionBankData>();

  // Add all existing banks to the map
  for (const bank of existingBanks) {
    bankMap.set(bank.name, { ...bank });
  }

  // Merge new banks
  for (const newBank of newBanks) {
    const existingBank = bankMap.get(newBank.name);
    if (existingBank) {
      // Merge MCQs
      const existingMcqIds = new Set(existingBank.mcqs.map(mcq => mcq.id));
      const mcqsToMerge = newBank.mcqs.filter(mcq => !existingMcqIds.has(mcq.id));
      
      // Merge sub-banks recursively
      const mergedSubBanks = mergeQuestionBanks(existingBank.subBanks || [], newBank.subBanks || []);

      bankMap.set(newBank.name, {
        ...existingBank,
        mcqs: [...existingBank.mcqs, ...mcqsToMerge],
        subBanks: mergedSubBanks,
      });
    } else {
      // Add new bank
      bankMap.set(newBank.name, newBank);
    }
  }

  return Array.from(bankMap.values());
};
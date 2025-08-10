import { QuestionBankData, McqData } from "@/data/questionBanks";
import { SrsSettings } from "@/contexts/SettingsContext";
import { State } from "ts-fsrs";

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

export const buildMcqSessionQueue = (
  questionBanks: QuestionBankData[],
  settings: SrsSettings,
  introducedMcqIds: Set<string>
): McqData[] => {
  const now = new Date();
  const allMcqs = questionBanks.flatMap(bank => getAllMcqsFromBank(bank));

  const isNew = (mcq: McqData) => !introducedMcqIds.has(mcq.id) && (settings.scheduler === 'fsrs6' ? !mcq.srs?.fsrs6 || mcq.srs.fsrs6.state === State.New : !mcq.srs?.fsrs || mcq.srs.fsrs.state === State.New);
  const isDue = (mcq: McqData) => (settings.scheduler === 'fsrs6' ? mcq.srs?.fsrs6 && new Date(mcq.srs.fsrs6.due) <= now : mcq.srs?.fsrs && new Date(mcq.srs.fsrs.due) <= now);
  const isLearning = (mcq: McqData) => isDue(mcq) && (settings.scheduler === 'fsrs6' ? mcq.srs?.fsrs6?.state === State.Learning || mcq.srs?.fsrs6?.state === State.Relearning : mcq.srs?.fsrs?.state === State.Learning || mcq.srs?.fsrs?.state === State.Relearning);
  const isReview = (mcq: McqData) => isDue(mcq) && (settings.scheduler === 'fsrs6' ? mcq.srs?.fsrs6?.state === State.Review : mcq.srs?.fsrs?.state === State.Review);

  const sessionNew: McqData[] = [];
  const sessionReviews: McqData[] = [];
  const sessionLearning: McqData[] = [];

  let newBudget = settings.mcqNewCardsPerDay - introducedMcqIds.size;
  let reviewBudget = settings.mcqMaxReviewsPerDay;

  for (const mcq of allMcqs) {
    if (isLearning(mcq)) {
      sessionLearning.push(mcq);
    } else if (isReview(mcq) && reviewBudget > 0) {
      sessionReviews.push(mcq);
      reviewBudget--;
    } else if (isNew(mcq) && newBudget > 0) {
      sessionNew.push(mcq);
      newBudget--;
    }
  }

  const sortedNew = shuffle(sessionNew);
  const sortedReviews = shuffle(sessionReviews);
  const learningCombined = sessionLearning.sort((a, b) => new Date(a.srs!.fsrs?.due || a.srs!.fsrs6!.due).getTime() - new Date(b.srs!.fsrs?.due || b.srs!.fsrs6!.due).getTime());

  return [...learningCombined, ...shuffle([...sortedReviews, ...sortedNew])];
};
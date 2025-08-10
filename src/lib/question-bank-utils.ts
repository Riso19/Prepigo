import { QuestionBankData, McqData } from "@/data/questionBanks";

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
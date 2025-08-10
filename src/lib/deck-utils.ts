import { DeckData, FlashcardData } from "@/data/decks";
import { SrsSettings } from "@/contexts/SettingsContext";
import { State } from "ts-fsrs";

// Recursively find a deck by its ID
export const findDeckById = (decks: DeckData[], id: string): DeckData | null => {
  for (const deck of decks) {
    if (deck.id === id) return deck;
    if (deck.subDecks) {
      const found = findDeckById(deck.subDecks, id);
      if (found) return found;
    }
  }
  return null;
};

// Recursively find the path of a deck by its ID
export const findDeckPathById = (decks: DeckData[], deckId: string, currentPath: string[] = []): string[] | null => {
  for (const deck of decks) {
    const newPath = [...currentPath, deck.name];
    if (deck.id === deckId) {
      return newPath;
    }
    if (deck.subDecks) {
      const foundPath = findDeckPathById(deck.subDecks, deckId, newPath);
      if (foundPath) {
        return foundPath;
      }
    }
  }
  return null;
};

// Recursively get all flashcards from a deck and its sub-decks
export const getAllFlashcardsFromDeck = (deck: DeckData): FlashcardData[] => {
  let flashcards = [...deck.flashcards];
  if (deck.subDecks) {
    for (const subDeck of deck.subDecks) {
      flashcards = [...flashcards, ...getAllFlashcardsFromDeck(subDeck)];
    }
  }
  return flashcards;
};

// Immutably add a sub-deck to a parent deck
export const addSubDeckToDeck = (decks: DeckData[], parentId: string, newSubDeck: DeckData): DeckData[] => {
  return decks.map(deck => {
    if (deck.id === parentId) {
      return { ...deck, subDecks: [...(deck.subDecks || []), newSubDeck] };
    }
    if (deck.subDecks) {
      return { ...deck, subDecks: addSubDeckToDeck(deck.subDecks, parentId, newSubDeck) };
    }
    return deck;
  });
};

// Immutably add a flashcard to a parent deck
export const addFlashcardToDeck = (decks: DeckData[], parentId:string, newFlashcard: FlashcardData): DeckData[] => {
    return decks.map(deck => {
        if (deck.id === parentId) {
            return { ...deck, flashcards: [...deck.flashcards, newFlashcard] };
        }
        if (deck.subDecks) {
            return { ...deck, subDecks: addFlashcardToDeck(deck.subDecks, parentId, newFlashcard) };
        }
        return deck;
    });
}

// Find a flashcard by its ID across all decks
export const findFlashcardById = (decks: DeckData[], flashcardId: string): { flashcard: FlashcardData, deckId: string } | null => {
  for (const deck of decks) {
    const flashcard = deck.flashcards.find(fc => fc.id === flashcardId);
    if (flashcard) {
      return { flashcard, deckId: deck.id };
    }
    if (deck.subDecks) {
      const found = findFlashcardById(deck.subDecks, flashcardId);
      if (found) return found;
    }
  }
  return null;
};

// Immutably delete a flashcard from any deck/sub-deck
export const deleteFlashcard = (decks: DeckData[], flashcardId: string): DeckData[] => {
  return decks.map(deck => {
    const newFlashcards = deck.flashcards.filter(fc => fc.id !== flashcardId);
    
    let newSubDecks = deck.subDecks;
    if (deck.subDecks) {
      newSubDecks = deleteFlashcard(deck.subDecks, flashcardId);
    }

    return { ...deck, flashcards: newFlashcards, subDecks: newSubDecks };
  });
};

// Immutably delete a deck from the hierarchy
export const deleteDeck = (decks: DeckData[], deckIdToDelete: string): DeckData[] => {
  const newDecks = decks.filter(deck => deck.id !== deckIdToDelete);

  return newDecks.map(deck => {
    if (deck.subDecks) {
      return { ...deck, subDecks: deleteDeck(deck.subDecks, deckIdToDelete) };
    }
    return deck;
  });
};

// Immutably update a flashcard in any deck/sub-deck
export const updateFlashcard = (decks: DeckData[], updatedFlashcard: FlashcardData): DeckData[] => {
  return decks.map(deck => {
    const flashcardIndex = deck.flashcards.findIndex(fc => fc.id === updatedFlashcard.id);
    
    let newFlashcards = deck.flashcards;
    if (flashcardIndex > -1) {
      newFlashcards = [
        ...deck.flashcards.slice(0, flashcardIndex),
        updatedFlashcard,
        ...deck.flashcards.slice(flashcardIndex + 1),
      ];
    }

    let newSubDecks = deck.subDecks;
    if (deck.subDecks) {
      newSubDecks = updateFlashcard(deck.subDecks, updatedFlashcard);
    }

    return { ...deck, flashcards: newFlashcards, subDecks: newSubDecks };
  });
};

// Get all unique tags from all decks
export const getAllTags = (decks: DeckData[]): string[] => {
    const allTags = new Set<string>();
    const collectTags = (deck: DeckData) => {
        deck.flashcards.forEach(fc => {
            fc.tags?.forEach(tag => allTags.add(tag));
        });
        deck.subDecks?.forEach(collectTags);
    };
    decks.forEach(collectTags);
    return Array.from(allTags).sort((a, b) => a.localeCompare(b));
};

// Immutably update tags for all cards belonging to a note
export const updateNoteTags = (decks: DeckData[], noteId: string, newTags: string[]): DeckData[] => {
  return decks.map(deck => {
    const newFlashcards = deck.flashcards.map(fc => {
      if (fc.noteId === noteId) {
        return { ...fc, tags: newTags };
      }
      return fc;
    });
    
    let newSubDecks = deck.subDecks;
    if (deck.subDecks) {
      newSubDecks = updateNoteTags(deck.subDecks, noteId, newTags);
    }

    return { ...deck, flashcards: newFlashcards, subDecks: newSubDecks };
  });
};

export const tagLeech = (decks: DeckData[], flashcardId: string): DeckData[] => {
  return decks.map(deck => {
    const flashcardIndex = deck.flashcards.findIndex(fc => fc.id === flashcardId);
    
    if (flashcardIndex > -1) {
      const flashcard = deck.flashcards[flashcardIndex];
      const newTags = [...(flashcard.tags || [])];
      if (!newTags.includes('leech')) {
        newTags.push('leech');
      }
      const updatedFlashcard = { ...flashcard, tags: newTags };
      
      return {
        ...deck,
        flashcards: [
          ...deck.flashcards.slice(0, flashcardIndex),
          updatedFlashcard,
          ...deck.flashcards.slice(flashcardIndex + 1),
        ],
      };
    }

    if (deck.subDecks) {
      return { ...deck, subDecks: tagLeech(deck.subDecks, flashcardId) };
    }

    return deck;
  });
};

// Immutably merge new decks into existing decks
export const mergeDecks = (existingDecks: DeckData[], newDecks: DeckData[]): DeckData[] => {
  const deckMap = new Map<string, DeckData>();

  // Add all existing decks to the map
  for (const deck of existingDecks) {
    deckMap.set(deck.name, { ...deck });
  }

  // Merge new decks
  for (const newDeck of newDecks) {
    const existingDeck = deckMap.get(newDeck.name);
    if (existingDeck) {
      // Merge flashcards
      const existingFlashcardIds = new Set(existingDeck.flashcards.map(fc => fc.id));
      const flashcardsToMerge = newDeck.flashcards.filter(fc => !existingFlashcardIds.has(fc.id));
      
      // Merge sub-decks
      const mergedSubDecks = mergeDecks(existingDeck.subDecks || [], newDeck.subDecks || []);

      deckMap.set(newDeck.name, {
        ...existingDeck,
        flashcards: [...existingDeck.flashcards, ...flashcardsToMerge],
        subDecks: mergedSubDecks,
      });
    } else {
      // Add new deck
      deckMap.set(newDeck.name, newDeck);
    }
  }

  return Array.from(deckMap.values());
};

export const moveDeck = (decks: DeckData[], activeId: string, overId: string | null): DeckData[] => {
  const decksCopy = JSON.parse(JSON.stringify(decks));

  // Find the deck being moved and remove it from its parent
  const findAndSplice = (currentDecks: DeckData[]): DeckData | null => {
    for (let i = 0; i < currentDecks.length; i++) {
      if (currentDecks[i].id === activeId) {
        const [deckToMove] = currentDecks.splice(i, 1);
        return deckToMove;
      }
      if (currentDecks[i].subDecks) {
        const found = findAndSplice(currentDecks[i].subDecks!);
        if (found) return found;
      }
    }
    return null;
  };

  const deckToMove = findAndSplice(decksCopy);

  if (!deckToMove) {
    return decks; // Deck to move not found, return original state
  }

  if (overId === 'root-droppable' || overId === null) {
    // Move to the root
    decksCopy.push(deckToMove);
  } else {
    // Move into another deck
    const overDeck = findDeckById(decksCopy, overId);
    if (overDeck) {
      // Prevent nesting a deck inside itself or one of its own children
      if (findDeckById([deckToMove], overId)) {
        return decks; // Invalid move, return original state
      }
      if (!overDeck.subDecks) {
        overDeck.subDecks = [];
      }
      overDeck.subDecks.push(deckToMove);
    } else {
      // If the target isn't a valid deck, revert the change.
      return decks;
    }
  }

  return decksCopy;
};

export const updateDeck = (decks: DeckData[], updatedDeck: DeckData): DeckData[] => {
  return decks.map(deck => {
    if (deck.id === updatedDeck.id) {
      return updatedDeck;
    }
    if (deck.subDecks) {
      return { ...deck, subDecks: updateDeck(deck.subDecks, updatedDeck) };
    }
    return deck;
  });
};

export const findDeckWithAncestors = (
  decks: DeckData[],
  deckId: string,
  ancestors: DeckData[] = []
): { deck: DeckData; ancestors: DeckData[] } | null => {
  for (const deck of decks) {
    if (deck.id === deckId) {
      return { deck, ancestors };
    }
    if (deck.subDecks) {
      const found = findDeckWithAncestors(deck.subDecks, deckId, [...ancestors, deck]);
      if (found) return found;
    }
  }
  return null;
};

export const getEffectiveSrsSettingsWithSource = (
  decks: DeckData[],
  deckId: string,
  globalSettings: SrsSettings
): { settings: SrsSettings; sourceName: string } => {
  const result = findDeckWithAncestors(decks, deckId);
  if (!result) return { settings: globalSettings, sourceName: 'Global' };

  const { deck, ancestors } = result;
  const hierarchy = [...ancestors, deck];

  for (let i = hierarchy.length - 1; i >= 0; i--) {
    const currentDeck = hierarchy[i];
    if (currentDeck.hasCustomSettings && currentDeck.srsSettings) {
      return { settings: currentDeck.srsSettings, sourceName: currentDeck.name };
    }
  }

  return { settings: globalSettings, sourceName: 'Global' };
};


export const getEffectiveSrsSettings = (
  decks: DeckData[],
  deckId: string,
  globalSettings: SrsSettings
): SrsSettings => {
  return getEffectiveSrsSettingsWithSource(decks, deckId, globalSettings).settings;
};

const parseSteps = (steps: string): number[] => {
  return steps.trim().split(/\s+/).filter(s => s).map(stepStr => {
    const value = parseFloat(stepStr);
    if (isNaN(value)) return 1;
    if (stepStr.endsWith('d')) return value * 24 * 60;
    if (stepStr.endsWith('h')) return value * 60;
    if (stepStr.endsWith('s')) return Math.max(1, value / 60);
    return value;
  });
};

const shuffle = <T,>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const getDeckDueCounts = (
  deck: DeckData,
  allDecks: DeckData[],
  globalSettings: SrsSettings
): { newCount: number; learnCount: number; dueCount: number } => {
  const now = new Date();
  let counts = { newCount: 0, learnCount: 0, dueCount: 0 };

  const settings = getEffectiveSrsSettings(allDecks, deck.id, globalSettings);

  for (const card of deck.flashcards) {
    if (card.srs?.isSuspended) continue;

    let isCardNew = false;
    let isCardDue = false;
    let isCardLearning = false;
    let isCardReview = false;

    if (settings.scheduler === 'sm2') {
      const sm2State = card.srs?.sm2;
      isCardNew = !sm2State || sm2State.state === 'new' || !sm2State.state;
      isCardDue = !!sm2State && new Date(sm2State.due) <= now;
      if (isCardDue) {
        isCardLearning = sm2State.state === 'learning' || sm2State.state === 'relearning';
        isCardReview = sm2State.state === 'review';
      }
    } else { // FSRS or FSRS6
      const srsData = settings.scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
      isCardNew = !srsData || srsData.state === State.New;
      isCardDue = !!srsData && new Date(srsData.due) <= now;
      if (isCardDue) {
        isCardLearning = srsData.state === State.Learning || srsData.state === State.Relearning;
        isCardReview = srsData.state === State.Review;
      }
    }

    if (isCardNew) {
      counts.newCount++;
      continue;
    }

    if (isCardDue) {
      if (isCardLearning) {
        counts.learnCount++;
      } else if (isCardReview) {
        counts.dueCount++;
      }
    }
  }

  if (deck.subDecks) {
    for (const subDeck of deck.subDecks) {
      const subCounts = getDeckDueCounts(subDeck, allDecks, globalSettings);
      counts.newCount += subCounts.newCount;
      counts.learnCount += subCounts.learnCount;
      counts.dueCount += subCounts.dueCount;
    }
  }

  return counts;
};

export const buildSessionQueue = (
  decksToStudy: DeckData[],
  allDecks: DeckData[],
  globalSettings: SrsSettings,
  introducedTodayIds: Set<string>
): FlashcardData[] => {
  const now = new Date();

  const isNew = (card: FlashcardData, s: SrsSettings) => {
    if (introducedTodayIds.has(card.id) || card.srs?.isSuspended) return false;
    if (s.scheduler === 'sm2') return !card.srs?.sm2 || card.srs.sm2.state === 'new' || !card.srs.sm2.state;
    const srsData = s.scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
    return !srsData || srsData.state === State.New;
  };

  const isDue = (card: FlashcardData, s: SrsSettings) => {
    if (card.srs?.isSuspended) return false;
    if (s.scheduler === 'sm2') return !!card.srs?.sm2 && new Date(card.srs.sm2.due) <= now;
    const srsData = s.scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
    return !!srsData && new Date(srsData.due) <= now;
  };

  const isLearning = (card: FlashcardData, s: SrsSettings) => {
    if (!isDue(card, s)) return false;
    if (s.scheduler === 'sm2') return card.srs?.sm2?.state === 'learning' || card.srs?.sm2?.state === 'relearning';
    const srsData = s.scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
    return !!srsData && (srsData.state === State.Learning || srsData.state === State.Relearning);
  };

  const isInterdayLearning = (card: FlashcardData, s: SrsSettings) => {
    if (!isLearning(card, s)) return false;
    if (s.scheduler === 'sm2') {
        const sm2State = card.srs!.sm2!;
        const steps = parseSteps(sm2State.state === 'learning' ? s.learningSteps : s.relearningSteps);
        const currentStep = sm2State.learning_step || 0;
        if (currentStep >= steps.length) return true;
        return steps[currentStep] >= 1440;
    }
    return false;
  };

  const isIntradayLearning = (card: FlashcardData, s: SrsSettings) => isLearning(card, s) && !isInterdayLearning(card, s);

  const isReview = (card: FlashcardData, s: SrsSettings) => {
    if (!isDue(card, s)) return false;
    if (s.scheduler === 'sm2') return card.srs?.sm2?.state === 'review';
    const srsData = s.scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
    return !!srsData && srsData.state === State.Review;
  };

  const sessionNew: FlashcardData[] = [];
  const sessionReviews: FlashcardData[] = [];
  const sessionLearning: FlashcardData[] = [];

  const recursiveGather = (deck: DeckData, newBudget: number, reviewBudget: number): { newTaken: number, reviewsTaken: number } => {
    const settings = getEffectiveSrsSettings(allDecks, deck.id, globalSettings);
    const currentNewBudget = Math.min(newBudget, settings.newCardsPerDay);
    const currentReviewBudget = Math.min(reviewBudget, settings.maxReviewsPerDay);
    let newTaken = 0;
    let reviewsTaken = 0;

    const cards = deck.flashcards;
    sessionLearning.push(...cards.filter(c => isIntradayLearning(c, settings)));
    
    const potentialReviews = cards.filter(c => isReview(c, settings) || isInterdayLearning(c, settings));
    const reviewsToTake = Math.min(potentialReviews.length, currentReviewBudget);
    if (reviewsToTake > 0) {
      sessionReviews.push(...potentialReviews.slice(0, reviewsToTake));
      reviewsTaken += reviewsToTake;
    }

    const canTakeNew = globalSettings.newCardsIgnoreReviewLimit || reviewsTaken < currentReviewBudget;
    if (canTakeNew) {
      const potentialNew = cards.filter(c => isNew(c, settings));
      const newToTake = Math.min(potentialNew.length, currentNewBudget);
      if (newToTake > 0) {
        sessionNew.push(...potentialNew.slice(0, newToTake));
        newTaken += newToTake;
      }
    }

    if (deck.subDecks) {
      for (const subDeck of deck.subDecks) {
        const remainingNew = newBudget - newTaken;
        const remainingReview = reviewBudget - reviewsTaken;
        if (remainingNew <= 0 && remainingReview <= 0) break;
        const { newTaken: subNew, reviewsTaken: subReviews } = recursiveGather(subDeck, remainingNew, remainingReview);
        newTaken += subNew;
        reviewsTaken += subReviews;
      }
    }
    return { newTaken, reviewsTaken };
  };

  let remainingNewBudget = Math.max(0, globalSettings.newCardsPerDay - introducedTodayIds.size);
  let remainingReviewBudget = globalSettings.maxReviewsPerDay;

  for (const deck of decksToStudy) {
    if (remainingNewBudget <= 0 && remainingReviewBudget <= 0 && !globalSettings.newCardsIgnoreReviewLimit) {
      break;
    }
    
    const { newTaken, reviewsTaken } = recursiveGather(deck, remainingNewBudget, remainingReviewBudget);
    
    remainingNewBudget -= newTaken;
    remainingReviewBudget -= reviewsTaken;
  }

  let gatheredNew = [...new Set(sessionNew)];
  if (globalSettings.newCardGatherOrder === 'ascending') gatheredNew.sort((a, b) => (a.srs?.newCardOrder || 0) - (b.srs?.newCardOrder || 0));
  if (globalSettings.newCardGatherOrder === 'descending') gatheredNew.sort((a, b) => (b.srs?.newCardOrder || 0) - (a.srs?.newCardOrder || 0));
  if (globalSettings.newCardGatherOrder === 'randomCards' || globalSettings.newCardGatherOrder === 'randomNotes') gatheredNew = shuffle(gatheredNew);

  let sortedNew = gatheredNew;
  if (globalSettings.newCardSortOrder === 'random') sortedNew = shuffle(sortedNew);

  let sortedReviews = [...new Set(sessionReviews)];
  if (globalSettings.reviewSortOrder === 'dueDateRandom') {
    sortedReviews.sort((a, b) => new Date(a.srs!.fsrs?.due || a.srs!.sm2!.due).getTime() - new Date(b.srs!.fsrs?.due || b.srs!.sm2!.due).getTime());
    sortedReviews = shuffle(sortedReviews);
  }

  const learningCombined = [...new Set(sessionLearning)].sort((a, b) => new Date(a.srs!.fsrs?.due || a.srs!.sm2!.due).getTime() - new Date(b.srs!.fsrs?.due || b.srs!.sm2!.due).getTime());

  const finalWithNew = globalSettings.newReviewOrder === 'mix' ? shuffle([...sortedReviews, ...sortedNew]) :
                       globalSettings.newReviewOrder === 'after' ? [...sortedReviews, ...sortedNew] :
                       [...sortedNew, ...sortedReviews];

  return [...learningCombined, ...finalWithNew];
};
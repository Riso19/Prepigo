import { DeckData, FlashcardData } from "@/data/decks";

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
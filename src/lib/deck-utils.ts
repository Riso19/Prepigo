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
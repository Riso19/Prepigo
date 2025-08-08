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
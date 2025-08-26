import { DeckData, FlashcardData } from "@/data/decks";

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

export interface FlashcardWithContext {
  flashcard: FlashcardData;
  deckPath: string[];
  deckId: string;
}

export const getAllFlashcardsWithDeckPath = (deck: DeckData, currentPath: string[] = []): FlashcardWithContext[] => {
  const newPath = [...currentPath, deck.name];
  let flashcardsWithContext: FlashcardWithContext[] = deck.flashcards.map(flashcard => ({
    flashcard,
    deckPath: newPath,
    deckId: deck.id,
  }));

  if (deck.subDecks) {
    for (const subDeck of deck.subDecks) {
      flashcardsWithContext = [
        ...flashcardsWithContext,
        ...getAllFlashcardsWithDeckPath(subDeck, newPath),
      ];
    }
  }
  return flashcardsWithContext;
};
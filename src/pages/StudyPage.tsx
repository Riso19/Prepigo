import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { useSettings } from "@/contexts/SettingsContext";
import { findDeckById, getAllFlashcardsFromDeck, updateFlashcard } from "@/lib/deck-utils";
import { sm2 } from "@/lib/srs";
import { fsrs, ReviewRating } from "@/lib/fsrs";
import { addReviewLog } from "@/lib/idb";
import { FlashcardData } from "@/data/decks";
import { showSuccess } from "@/utils/toast";
import Flashcard from "@/components/Flashcard";
import ClozePlayer from "@/components/ClozePlayer";
import ImageOcclusionPlayer from "@/components/ImageOcclusionPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

const StudyPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  const allFlashcards = useMemo(() => (deck ? getAllFlashcardsFromDeck(deck) : []), [deck]);

  const [completedCardIds, setCompletedCardIds] = useState<Set<string>>(new Set());
  const [isFlipped, setIsFlipped] = useState(false);

  const sessionQueue = useMemo(() => {
    const now = new Date().toISOString();
    const due = allFlashcards
      .filter(card => !card.isSuspended)
      .filter(card => !card.nextReviewDate || card.nextReviewDate <= now);

    const newCards = due.filter(c => !c.interval || c.interval === 0);
    const reviewCards = due.filter(c => c.interval && c.interval > 0);

    if (settings.insertionOrder === 'sequential' && settings.algorithm === 'sm2') {
      newCards.sort((a, b) => a.id.localeCompare(b.id));
    } else {
      newCards.sort(() => Math.random() - 0.5);
    }
    reviewCards.sort(() => Math.random() - 0.5);

    const limitedNew = newCards.slice(0, settings.newCardsPerDay);
    const limitedReviews = reviewCards.slice(0, settings.maxReviewsPerDay);
    
    return [...limitedReviews, ...limitedNew];
  }, [allFlashcards, settings]);

  useEffect(() => {
    setCompletedCardIds(new Set());
  }, [deckId]);

  const remainingCards = useMemo(() => {
    return sessionQueue.filter(c => !completedCardIds.has(c.id));
  }, [sessionQueue, completedCardIds]);

  const currentCard = remainingCards.length > 0 ? remainingCards[0] : null;
  const initialDueCount = sessionQueue.length;

  useEffect(() => {
    if (initialDueCount > 0 && remainingCards.length === 0) {
      showSuccess("Congratulations! You've finished your review session.");
      navigate('/');
    }
  }, [remainingCards.length, initialDueCount, navigate]);

  const getSiblings = useCallback((card: FlashcardData, allCards: FlashcardData[]): FlashcardData[] => {
    if (!card) return [];
    if (card.type === 'imageOcclusion') {
      return allCards.filter(c => c.id !== card.id && c.type === 'imageOcclusion' && c.imageUrl === card.imageUrl && c.occlusions === card.occlusions);
    }
    if (card.type === 'basic') {
      return allCards.filter(c => c.id !== card.id && c.type === 'basic' && c.question === card.answer && c.answer === card.question);
    }
    return [];
  }, []);

  const handleRating = useCallback(async (rating: ReviewRating) => {
    if (!currentCard) return;

    const now = new Date();
    let updatedCard: FlashcardData;

    if (settings.algorithm === 'fsrs') {
      let elapsedDays = 0;
      if (currentCard.lastReviewDate) {
        const lastReview = new Date(currentCard.lastReviewDate);
        elapsedDays = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
      }

      const cardData = { stability: currentCard.stability, difficulty: currentCard.difficulty };
      const newSrsData = fsrs(cardData, rating, elapsedDays, settings.fsrsParameters);
      
      const nextReviewDate = new Date(new Date().setDate(now.getDate() + newSrsData.interval));

      updatedCard = {
        ...currentCard,
        stability: newSrsData.stability,
        difficulty: newSrsData.difficulty,
        interval: newSrsData.interval,
        nextReviewDate: nextReviewDate.toISOString(),
        lastReviewDate: now.toISOString(),
        repetitions: (currentCard.repetitions || 0) + 1,
        lapses: rating === 1 ? (currentCard.lapses || 0) + 1 : currentCard.lapses,
      };

      await addReviewLog({ cardId: currentCard.id, reviewTime: new Date().toISOString(), rating });

    } else { // SM-2 Logic
      const quality = rating === 1 ? 0 : rating + 1;
      const srsData = {
        repetitions: currentCard.repetitions || 0,
        easeFactor: currentCard.easeFactor || settings.initialEaseFactor,
        interval: currentCard.interval || 0,
        lapses: currentCard.lapses || 0,
        isSuspended: currentCard.isSuspended || false,
        lastInterval: currentCard.lastInterval,
      };
      const newSrsData = sm2(srsData, quality, settings);
      const nextReviewDate = new Date(new Date().setDate(now.getDate() + newSrsData.interval));
      updatedCard = { ...currentCard, ...newSrsData, nextReviewDate: nextReviewDate.toISOString(), lastReviewDate: now.toISOString() };
    }
    
    const idsToComplete = new Set<string>([currentCard.id]);
    if (settings.algorithm === 'sm2') {
        const siblings = getSiblings(currentCard, allFlashcards);
        siblings.forEach(sibling => {
            const isNew = !sibling.interval || sibling.interval === 0;
            const isReview = sibling.interval && sibling.interval >= settings.graduatingInterval;
            const isInterdayLearning = sibling.interval && sibling.interval >= 1 && sibling.interval < settings.graduatingInterval;

            if (isNew && settings.buryNewSiblings) idsToComplete.add(sibling.id);
            if (isReview && settings.buryReviewSiblings) idsToComplete.add(sibling.id);
            if (isInterdayLearning && settings.buryInterdayLearningSiblings) idsToComplete.add(sibling.id);
        });
    }

    setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard));
    setCompletedCardIds(prev => new Set([...prev, ...idsToComplete]));
    setIsFlipped(false);
  }, [currentCard, setDecks, settings, getSiblings, allFlashcards]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isFlipped) {
        event.preventDefault();
        setIsFlipped(true);
        return;
      }
      if (isFlipped) {
        switch (event.key) {
          case '1': handleRating(1); break;
          case '2': handleRating(2); break;
          case '3': handleRating(3); break;
          case '4': handleRating(4); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleRating]);

  if (!deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">Deck not found</h2>
        <Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button>
      </div>
    );
  }

  if (allFlashcards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">This deck is empty!</h2>
        <Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button>
      </div>
    );
  }

  if (initialDueCount > 0 && remainingCards.length === 0) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
            <h2 className="text-2xl font-bold mb-4">Session Complete!</h2>
            <p className="text-muted-foreground mb-6">Redirecting you back to your decks...</p>
        </div>
    );
  }

  if (sessionQueue.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">All caught up!</h2>
        <p className="text-muted-foreground mb-6">You have no cards due for review in this deck.</p>
        <Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button>
      </div>
    );
  }

  const handleCardClick = () => !isFlipped && setIsFlipped(true);

  const renderCard = () => {
    if (!currentCard) return null;
    switch (currentCard.type) {
      case 'basic':
        return <Flashcard question={currentCard.question} answer={currentCard.answer} isFlipped={isFlipped} onClick={handleCardClick} />;
      case 'cloze':
        return <ClozePlayer text={currentCard.text} description={currentCard.description} isFlipped={isFlipped} onClick={handleCardClick} />;
      case 'imageOcclusion':
        return <ImageOcclusionPlayer imageUrl={currentCard.imageUrl} occlusions={currentCard.occlusions} questionOcclusionId={currentCard.questionOcclusionId} description={currentCard.description} isFlipped={isFlipped} onClick={handleCardClick} />;
      default:
        return null;
    }
  };

  const currentCardNumber = initialDueCount - remainingCards.length + 1;

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
       <Button variant="ghost" onClick={() => navigate("/")} className="absolute top-4 left-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
      </Button>
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-center">Studying: {deck.name}</h1>
        {renderCard()}
        <div className="text-sm text-muted-foreground">
          {initialDueCount > 0 && `Card ${currentCardNumber} of ${initialDueCount}`}
        </div>
        <div className="w-full mt-4">
          {isFlipped ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              <Button onClick={() => handleRating(1)} className="relative bg-red-500 hover:bg-red-600 text-white font-bold h-16 text-base">Again<span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">1</span></Button>
              <Button onClick={() => handleRating(2)} className="relative bg-orange-400 hover:bg-orange-500 text-white font-bold h-16 text-base">Hard<span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">2</span></Button>
              <Button onClick={() => handleRating(3)} className="relative bg-green-500 hover:bg-green-600 text-white font-bold h-16 text-base">Good<span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">3</span></Button>
              <Button onClick={() => handleRating(4)} className="relative bg-blue-500 hover:bg-blue-600 text-white font-bold h-16 text-base">Easy<span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">4</span></Button>
            </div>
          ) : (
            <Button onClick={() => setIsFlipped(true)} className="w-full h-16 text-lg relative">Show Answer<span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">Space</span></Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyPage;
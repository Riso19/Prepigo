import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { useSettings } from "@/contexts/SettingsContext";
import { findDeckById, getAllFlashcardsFromDeck, updateFlashcard } from "@/lib/deck-utils";
import { addReviewLog } from "@/lib/idb";
import { FlashcardData, ReviewLog } from "@/data/decks";
import { showSuccess } from "@/utils/toast";
import Flashcard from "@/components/Flashcard";
import ClozePlayer from "@/components/ClozePlayer";
import ImageOcclusionPlayer from "@/components/ImageOcclusionPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { fsrs, Card, State, Rating, RecordLog, generatorParameters, createEmptyCard } from "ts-fsrs";

const StudyPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  
  const [completedCardIds, setCompletedCardIds] = useState<Set<string>>(new Set());
  const [isFlipped, setIsFlipped] = useState(false);
  const [scheduledOutcomes, setScheduledOutcomes] = useState<RecordLog | null>(null);

  const fsrsInstance = useMemo(() => {
    const params = generatorParameters(settings.fsrsParameters);
    return fsrs(params);
  }, [settings.fsrsParameters]);

  const sessionQueue = useMemo(() => {
    if (!deck) return [];

    const now = new Date();
    const allCards = getAllFlashcardsFromDeck(deck);
    
    const dueCards = allCards
      .filter(card => !card.isSuspended)
      .filter(card => !card.due || new Date(card.due) <= now);

    const newCards = dueCards
      .filter(c => c.state === undefined || c.state === State.New)
      .slice(0, settings.newCardsPerDay);
      
    const reviewCards = dueCards
      .filter(c => c.state !== undefined && c.state !== State.New)
      .slice(0, settings.maxReviewsPerDay);

    return [...reviewCards, ...newCards].sort(() => Math.random() - 0.5);
  }, [deck, settings.newCardsPerDay, settings.maxReviewsPerDay]);

  useEffect(() => {
    setCompletedCardIds(new Set());
    setIsFlipped(false);
    setScheduledOutcomes(null);
  }, [deckId]);

  const remainingCards = useMemo(() => {
    return sessionQueue.filter(c => !completedCardIds.has(c.id));
  }, [sessionQueue, completedCardIds]);

  const currentCard = remainingCards.length > 0 ? remainingCards[0] : null;
  const initialDueCount = sessionQueue.length;

  useEffect(() => {
    if (isFlipped && currentCard && !scheduledOutcomes) {
      const cardToReview: Card = {
        ...createEmptyCard(currentCard.due ? new Date(currentCard.due) : new Date()),
        ...currentCard,
        due: currentCard.due ? new Date(currentCard.due) : new Date(),
        last_review: currentCard.last_review ? new Date(currentCard.last_review) : undefined,
      };

      const outcomes = fsrsInstance.repeat(cardToReview, new Date());
      setScheduledOutcomes(outcomes);
    }
  }, [isFlipped, currentCard, scheduledOutcomes, fsrsInstance]);

  useEffect(() => {
    if (initialDueCount > 0 && remainingCards.length === 0) {
      showSuccess("Congratulations! You've finished your review session.");
      navigate('/');
    }
  }, [remainingCards.length, initialDueCount, navigate]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard || !scheduledOutcomes) return;

    const result = scheduledOutcomes[rating];
    const updatedFsrsCard = result.card;

    const updatedCard: FlashcardData = {
      ...currentCard,
      ...updatedFsrsCard,
      due: updatedFsrsCard.due.toISOString(),
      last_review: updatedFsrsCard.last_review?.toISOString(),
    };
    
    const logToSave: ReviewLog = {
      cardId: currentCard.id,
      ...result.log,
      due: result.log.due.toISOString(),
      review: result.log.review.toISOString(),
    };

    await addReviewLog(logToSave);
    setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard));
    
    setCompletedCardIds(prev => new Set([...prev, currentCard.id]));
    setIsFlipped(false);
    setScheduledOutcomes(null);
  }, [currentCard, scheduledOutcomes, setDecks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isFlipped) {
        event.preventDefault();
        setIsFlipped(true);
        return;
      }
      if (isFlipped) {
        switch (event.key) {
          case '1': handleRating(Rating.Again); break;
          case '2': handleRating(Rating.Hard); break;
          case '3': handleRating(Rating.Good); break;
          case '4': handleRating(Rating.Easy); break;
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

  if (getAllFlashcardsFromDeck(deck).length === 0) {
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

  const formatInterval = (interval: number): string => {
    if (interval < 1) {
      const minutes = Math.round(interval * 24 * 60);
      return `${minutes}m`;
    }
    if (interval < 30) {
      return `${Math.round(interval)}d`;
    }
    if (interval < 365) {
      const months = interval / 30;
      return `${Number.isInteger(months) ? months : months.toFixed(1)}mo`;
    }
    const years = interval / 365;
    return `${Number.isInteger(years) ? years : years.toFixed(1)}y`;
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
              <Button onClick={() => handleRating(Rating.Again)} className="relative bg-red-500 hover:bg-red-600 text-white font-bold h-16 text-base flex flex-col">
                <span>Again</span>
                {scheduledOutcomes && <span className="text-xs font-normal opacity-80">{formatInterval(scheduledOutcomes[Rating.Again].card.scheduled_days)}</span>}
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">1</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Hard)} className="relative bg-orange-400 hover:bg-orange-500 text-white font-bold h-16 text-base flex flex-col">
                <span>Hard</span>
                {scheduledOutcomes && <span className="text-xs font-normal opacity-80">{formatInterval(scheduledOutcomes[Rating.Hard].card.scheduled_days)}</span>}
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">2</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Good)} className="relative bg-green-500 hover:bg-green-600 text-white font-bold h-16 text-base flex flex-col">
                <span>Good</span>
                {scheduledOutcomes && <span className="text-xs font-normal opacity-80">{formatInterval(scheduledOutcomes[Rating.Good].card.scheduled_days)}</span>}
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">3</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Easy)} className="relative bg-blue-500 hover:bg-blue-600 text-white font-bold h-16 text-base flex flex-col">
                <span>Easy</span>
                {scheduledOutcomes && <span className="text-xs font-normal opacity-80">{formatInterval(scheduledOutcomes[Rating.Easy].card.scheduled_days)}</span>}
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">4</span>
              </Button>
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
import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { useSettings } from "@/contexts/SettingsContext";
import { findDeckById, getAllFlashcardsFromDeck, updateFlashcard } from "@/lib/deck-utils";
import { sm2 } from "@/lib/srs";
import { fsrs, Rating, ReviewRating, FsrsSchedulerResult } from "@/lib/fsrs";
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
  
  const [completedCardIds, setCompletedCardIds] = useState<Set<string>>(new Set());
  const [isFlipped, setIsFlipped] = useState(false);
  const [fsrsScheduledOutcomes, setFsrsScheduledOutcomes] = useState<FsrsSchedulerResult | null>(null);
  const [sm2ScheduledIntervals, setSm2ScheduledIntervals] = useState<{ [key in ReviewRating]: number } | null>(null);

  const sessionQueue = useMemo(() => {
    if (!deck) return [];

    const now = new Date();
    const allCards = getAllFlashcardsFromDeck(deck);
    
    const dueCards = allCards
      .filter(card => !card.isSuspended)
      .filter(card => !card.nextReviewDate || new Date(card.nextReviewDate) <= now);

    // 1. Classify Cards
    const newCards = dueCards.filter(c => !c.interval || c.interval === 0);
    const reviewCards = dueCards.filter(c => c.interval && c.interval > 0);

    // 2. Gather New Cards
    let gatheredNew: FlashcardData[] = [];
    switch (settings.newCardGatherOrder) {
      case 'ascending':
        gatheredNew = newCards.sort((a, b) => a.id.localeCompare(b.id));
        break;
      case 'descending':
        gatheredNew = newCards.sort((a, b) => b.id.localeCompare(a.id));
        break;
      case 'randomCards':
        gatheredNew = newCards.sort(() => Math.random() - 0.5);
        break;
      case 'deck':
      default:
        // Simplified 'deck' order: ascending by ID, which is close to creation order.
        gatheredNew = newCards.sort((a, b) => a.id.localeCompare(b.id));
        break;
    }
    
    // 3. Sort and Limit New Cards
    let newQueue = gatheredNew.slice(0, settings.newCardsPerDay);
    switch (settings.newCardSortOrder) {
        case 'random':
            newQueue.sort(() => Math.random() - 0.5);
            break;
        // Other sort orders are more complex and will behave as 'gathered' for now.
        case 'gathered':
        case 'typeThenGathered':
        default:
            // No change needed, already in gathered order.
            break;
    }

    // 4. Sort and Limit Review Cards
    let reviewQueue = reviewCards;
    switch (settings.reviewSortOrder) {
        case 'dueDateRandom':
        default:
            reviewQueue.sort((a, b) => {
                const dateA = new Date(a.nextReviewDate || 0).getTime();
                const dateB = new Date(b.nextReviewDate || 0).getTime();
                return dateA - dateB || (Math.random() - 0.5);
            });
            break;
    }
    reviewQueue = reviewQueue.slice(0, settings.maxReviewsPerDay);

    // 5. Combine Queues
    let finalQueue: FlashcardData[] = [];
    switch (settings.newReviewOrder) {
        case 'after':
            finalQueue = [...reviewQueue, ...newQueue];
            break;
        case 'before':
            finalQueue = [...newQueue, ...reviewQueue];
            break;
        case 'mix':
        default:
            finalQueue = [...reviewQueue, ...newQueue].sort(() => Math.random() - 0.5);
            break;
    }

    return finalQueue;
  }, [deck, settings]);

  useEffect(() => {
    setCompletedCardIds(new Set());
    setIsFlipped(false);
  }, [deckId]);

  const remainingCards = useMemo(() => {
    return sessionQueue.filter(c => !completedCardIds.has(c.id));
  }, [sessionQueue, completedCardIds]);

  const currentCard = remainingCards.length > 0 ? remainingCards[0] : null;
  const initialDueCount = sessionQueue.length;

  useEffect(() => {
    if (!currentCard) {
      setFsrsScheduledOutcomes(null);
      setSm2ScheduledIntervals(null);
      return;
    }

    if (settings.algorithm === 'fsrs') {
      setSm2ScheduledIntervals(null);
      const now = new Date();
      let elapsedDays = 0;
      if (currentCard.lastReviewDate) {
        const lastReview = new Date(currentCard.lastReviewDate);
        elapsedDays = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
      }
      const cardData = { stability: currentCard.stability, difficulty: currentCard.difficulty };
      const outcomes = fsrs(cardData, elapsedDays, settings.fsrsParameters);
      setFsrsScheduledOutcomes(outcomes);
    } else if (settings.algorithm === 'sm2') {
      setFsrsScheduledOutcomes(null);
      const srsData = {
        repetitions: currentCard.repetitions || 0,
        easeFactor: currentCard.easeFactor || settings.initialEaseFactor,
        interval: currentCard.interval || 0,
        lapses: currentCard.lapses || 0,
        isSuspended: currentCard.isSuspended || false,
        lastInterval: currentCard.lastInterval,
      };

      setSm2ScheduledIntervals({
        [Rating.Again]: sm2(srsData, 0, settings).interval,
        [Rating.Hard]: sm2(srsData, 3, settings).interval,
        [Rating.Good]: sm2(srsData, 4, settings).interval,
        [Rating.Easy]: sm2(srsData, 5, settings).interval,
      });
    }
  }, [currentCard, settings]);

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
    const allFlashcards = deck ? getAllFlashcardsFromDeck(deck) : [];

    if (settings.algorithm === 'fsrs') {
      if (!fsrsScheduledOutcomes) return;
    
      const newSrsData = fsrsScheduledOutcomes[rating];
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

      let elapsedDays = 0;
      if (currentCard.lastReviewDate) {
        const lastReview = new Date(currentCard.lastReviewDate);
        elapsedDays = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
      }

      await addReviewLog({
        cardId: currentCard.id,
        reviewTime: now.toISOString(),
        rating,
        previousStability: currentCard.stability,
        previousDifficulty: currentCard.difficulty,
        elapsedDays,
        newStability: newSrsData.stability,
        newDifficulty: newSrsData.difficulty,
        scheduledDays: newSrsData.interval,
      });

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
  }, [currentCard, setDecks, settings, getSiblings, deck, fsrsScheduledOutcomes]);

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
                {fsrsScheduledOutcomes && <span className="text-xs font-normal opacity-80">{formatInterval(fsrsScheduledOutcomes[Rating.Again].interval)}</span>}
                {sm2ScheduledIntervals && <span className="text-xs font-normal opacity-80">{formatInterval(sm2ScheduledIntervals[Rating.Again])}</span>}
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">1</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Hard)} className="relative bg-orange-400 hover:bg-orange-500 text-white font-bold h-16 text-base flex flex-col">
                <span>Hard</span>
                {fsrsScheduledOutcomes && <span className="text-xs font-normal opacity-80">{formatInterval(fsrsScheduledOutcomes[Rating.Hard].interval)}</span>}
                {sm2ScheduledIntervals && <span className="text-xs font-normal opacity-80">{formatInterval(sm2ScheduledIntervals[Rating.Hard])}</span>}
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">2</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Good)} className="relative bg-green-500 hover:bg-green-600 text-white font-bold h-16 text-base flex flex-col">
                <span>Good</span>
                {fsrsScheduledOutcomes && <span className="text-xs font-normal opacity-80">{formatInterval(fsrsScheduledOutcomes[Rating.Good].interval)}</span>}
                {sm2ScheduledIntervals && <span className="text-xs font-normal opacity-80">{formatInterval(sm2ScheduledIntervals[Rating.Good])}</span>}
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">3</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Easy)} className="relative bg-blue-500 hover:bg-blue-600 text-white font-bold h-16 text-base flex flex-col">
                <span>Easy</span>
                {fsrsScheduledOutcomes && <span className="text-xs font-normal opacity-80">{formatInterval(fsrsScheduledOutcomes[Rating.Easy].interval)}</span>}
                {sm2ScheduledIntervals && <span className="text-xs font-normal opacity-80">{formatInterval(sm2ScheduledIntervals[Rating.Easy])}</span>}
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
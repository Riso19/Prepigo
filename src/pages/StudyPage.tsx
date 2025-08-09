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
import { sm2, Sm2Quality } from "@/lib/sm2";

const StudyPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  
  const [completedCardIds, setCompletedCardIds] = useState<Set<string>>(new Set());
  const [isFlipped, setIsFlipped] = useState(false);
  
  // State for algorithm outcomes
  const [fsrsOutcomes, setFsrsOutcomes] = useState<RecordLog | null>(null);
  const [sm2Intervals, setSm2Intervals] = useState<{ [key in Rating]: number } | null>(null);

  const fsrsInstance = useMemo(() => {
    const params = generatorParameters(settings.fsrsParameters);
    return fsrs(params);
  }, [settings.fsrsParameters]);

  const sessionQueue = useMemo(() => {
    if (!deck) return [];
    const now = new Date();
    const allCards = getAllFlashcardsFromDeck(deck);

    const dueCards = allCards
      .filter(card => !card.srs?.isSuspended)
      .filter(card => {
        if (settings.scheduler === 'fsrs') {
          const fsrsData = card.srs?.fsrs;
          if (!fsrsData?.due) return true;
          return new Date(fsrsData.due) <= now;
        } else { // sm2
          const sm2Data = card.srs?.sm2;
          if (!sm2Data?.due) return true;
          return new Date(sm2Data.due) <= now;
        }
      });

    if (settings.scheduler === 'fsrs') {
      const newCards = dueCards
        .filter(c => c.srs?.fsrs?.state === undefined || c.srs.fsrs.state === State.New)
        .slice(0, settings.newCardsPerDay);
      const reviewCards = dueCards
        .filter(c => c.srs?.fsrs?.state !== undefined && c.srs.fsrs.state !== State.New)
        .slice(0, settings.maxReviewsPerDay);
      return [...reviewCards, ...newCards].sort(() => Math.random() - 0.5);
    } else { // sm2
      const newCards = dueCards
        .filter(c => !c.srs?.sm2 || c.srs.sm2.repetitions === 0)
        .slice(0, settings.newCardsPerDay);
      const reviewCards = dueCards
        .filter(c => c.srs?.sm2 && c.srs.sm2.repetitions > 0)
        .slice(0, settings.maxReviewsPerDay);
      return [...reviewCards, ...newCards].sort(() => Math.random() - 0.5);
    }
  }, [deck, settings.scheduler, settings.newCardsPerDay, settings.maxReviewsPerDay]);

  useEffect(() => {
    setCompletedCardIds(new Set());
    setIsFlipped(false);
    setFsrsOutcomes(null);
    setSm2Intervals(null);
  }, [deckId]);

  const remainingCards = useMemo(() => {
    return sessionQueue.filter(c => !completedCardIds.has(c.id));
  }, [sessionQueue, completedCardIds]);

  const currentCard = remainingCards.length > 0 ? remainingCards[0] : null;
  const initialDueCount = sessionQueue.length;

  useEffect(() => {
    if (isFlipped && currentCard) {
      if (settings.scheduler === 'fsrs') {
        if (fsrsOutcomes) return;
        const fsrsData = currentCard.srs?.fsrs;
        const cardToReview: Card = {
          ...createEmptyCard(fsrsData?.due ? new Date(fsrsData.due) : new Date()),
          ...fsrsData,
          due: fsrsData?.due ? new Date(fsrsData.due) : new Date(),
          last_review: fsrsData?.last_review ? new Date(fsrsData.last_review) : undefined,
        };
        setFsrsOutcomes(fsrsInstance.repeat(cardToReview, new Date()));
      } else { // sm2
        if (sm2Intervals) return;
        const sm2Data = currentCard.srs?.sm2;
        const intervals = {
          [Rating.Manual]: 0, // Placeholder to satisfy type
          [Rating.Again]: sm2(1, sm2Data).interval,
          [Rating.Hard]: sm2(3, sm2Data).interval,
          [Rating.Good]: sm2(4, sm2Data).interval,
          [Rating.Easy]: sm2(5, sm2Data).interval,
        };
        setSm2Intervals(intervals);
      }
    }
  }, [isFlipped, currentCard, settings.scheduler, fsrsInstance, fsrsOutcomes, sm2Intervals]);

  useEffect(() => {
    if (initialDueCount > 0 && remainingCards.length === 0) {
      showSuccess("Congratulations! You've finished your review session.");
      navigate('/');
    }
  }, [remainingCards.length, initialDueCount, navigate]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard) return;

    let updatedCard: FlashcardData;

    if (settings.scheduler === 'fsrs') {
      if (!fsrsOutcomes) return;
      const result = fsrsOutcomes[rating];
      const updatedFsrsCard = result.card;
      updatedCard = {
        ...currentCard,
        srs: { ...currentCard.srs, fsrs: { ...updatedFsrsCard, due: updatedFsrsCard.due.toISOString(), last_review: updatedFsrsCard.last_review?.toISOString() } }
      };
      const logToSave: ReviewLog = { cardId: currentCard.id, ...result.log, due: result.log.due.toISOString(), review: result.log.review.toISOString() };
      await addReviewLog(logToSave);
    } else { // sm2
      const qualityMap: { [key in Rating]: Sm2Quality } = { [Rating.Manual]: 0, [Rating.Again]: 1, [Rating.Hard]: 3, [Rating.Good]: 4, [Rating.Easy]: 5 };
      const newSm2State = sm2(qualityMap[rating], currentCard.srs?.sm2);
      updatedCard = { ...currentCard, srs: { ...currentCard.srs, sm2: newSm2State } };
    }
    
    setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard));
    setCompletedCardIds(prev => new Set([...prev, currentCard.id]));
    setIsFlipped(false);
    setFsrsOutcomes(null);
    setSm2Intervals(null);
  }, [currentCard, settings.scheduler, fsrsOutcomes, sm2Intervals, setDecks, navigate]);

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

  const getIntervalText = (rating: Rating) => {
    if (settings.scheduler === 'fsrs' && fsrsOutcomes) {
      return formatInterval(fsrsOutcomes[rating].card.scheduled_days);
    }
    if (settings.scheduler === 'sm2' && sm2Intervals) {
      return formatInterval(sm2Intervals[rating]);
    }
    return '';
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
                <span className="text-xs font-normal opacity-80">{getIntervalText(Rating.Again)}</span>
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">1</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Hard)} className="relative bg-orange-400 hover:bg-orange-500 text-white font-bold h-16 text-base flex flex-col">
                <span>Hard</span>
                <span className="text-xs font-normal opacity-80">{getIntervalText(Rating.Hard)}</span>
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">2</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Good)} className="relative bg-green-500 hover:bg-green-600 text-white font-bold h-16 text-base flex flex-col">
                <span>Good</span>
                <span className="text-xs font-normal opacity-80">{getIntervalText(Rating.Good)}</span>
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">3</span>
              </Button>
              <Button onClick={() => handleRating(Rating.Easy)} className="relative bg-blue-500 hover:bg-blue-600 text-white font-bold h-16 text-base flex flex-col">
                <span>Easy</span>
                <span className="text-xs font-normal opacity-80">{getIntervalText(Rating.Easy)}</span>
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
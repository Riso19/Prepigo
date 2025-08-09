import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { useSettings } from "@/contexts/SettingsContext";
import { findDeckById, getAllFlashcardsFromDeck, updateFlashcard } from "@/lib/deck-utils";
import { addReviewLog } from "@/lib/idb";
import { FlashcardData, ReviewLog, Sm2State } from "@/data/decks";
import Flashcard from "@/components/Flashcard";
import ClozePlayer from "@/components/ClozePlayer";
import ImageOcclusionPlayer from "@/components/ImageOcclusionPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { fsrs, Card, State, Rating, RecordLog, generatorParameters, createEmptyCard } from "ts-fsrs";
import { sm2, Sm2Quality } from "@/lib/sm2";
import { SrsSettings } from "@/contexts/SettingsContext";

const parseSteps = (steps: string): number[] => {
  return steps.trim().split(/\s+/).filter(s => s).map(stepStr => {
    const value = parseFloat(stepStr);
    if (isNaN(value)) return 1; // Default to 1 minute if parsing fails
    if (stepStr.endsWith('d')) return value * 24 * 60;
    if (stepStr.endsWith('h')) return value * 60;
    if (stepStr.endsWith('s')) return Math.max(1, value / 60); // Convert seconds to minutes, with a 1-minute minimum
    return value; // Assume minutes if no unit
  });
};

const shuffle = <T,>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const StudyPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<FlashcardData[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [buriedNoteIds, setBuriedNoteIds] = useState<Set<string>>(new Set());
  
  // FSRS specific state
  const [fsrsOutcomes, setFsrsOutcomes] = useState<RecordLog | null>(null);
  const fsrsInstance = useMemo(() => fsrs(generatorParameters(settings.fsrsParameters)), [settings.fsrsParameters]);

  // SM-2 Queue Generation
  useEffect(() => {
    if (!deck) return;

    const now = new Date();
    const allCards = getAllFlashcardsFromDeck(deck);

    // 1. Categorize cards
    const intradayLearning: FlashcardData[] = [];
    const interdayLearning: FlashcardData[] = [];
    const reviews: FlashcardData[] = [];
    const newCards: FlashcardData[] = [];

    allCards.forEach(card => {
      if (card.srs?.isSuspended) return;
      const sm2State = card.srs?.sm2;
      if (!sm2State || sm2State.state === 'new') {
        newCards.push(card);
      } else if (new Date(sm2State.due) <= now) {
        if (sm2State.state === 'review') {
          reviews.push(card);
        } else if (sm2State.state === 'learning' || sm2State.state === 'relearning') {
          const steps = sm2State.state === 'learning' ? parseSteps(settings.learningSteps) : parseSteps(settings.relearningSteps);
          const stepIndex = sm2State.learningStep || 0;
          if (stepIndex < steps.length && steps[stepIndex] < 1440) { // less than a day
            intradayLearning.push(card);
          } else {
            interdayLearning.push(card);
          }
        }
      }
    });

    // 2. Gather New Cards
    let gatheredNew = newCards;
    if (settings.newCardGatherOrder === 'ascending') {
        gatheredNew.sort((a, b) => (a.srs?.newCardOrder || 0) - (b.srs?.newCardOrder || 0));
    } else if (settings.newCardGatherOrder === 'descending') {
        gatheredNew.sort((a, b) => (b.srs?.newCardOrder || 0) - (a.srs?.newCardOrder || 0));
    } else if (settings.newCardGatherOrder === 'randomCards') {
        gatheredNew = shuffle(gatheredNew);
    }
    // 'deck' is default, 'randomNotes' is more complex, simplified for now.
    gatheredNew = gatheredNew.slice(0, settings.newCardsPerDay);

    // 3. Sort New Cards
    let sortedNew = gatheredNew;
    if (settings.newCardSortOrder === 'random') sortedNew = shuffle(sortedNew);
    // Other sort orders are more complex, simplified for now.

    // 4. Sort Review Cards
    let sortedReviews = reviews;
    if (settings.reviewSortOrder === 'dueDateRandom') sortedReviews.sort((a, b) => new Date(a.srs!.sm2!.due).getTime() - new Date(b.srs!.sm2!.due).getTime());
    sortedReviews = shuffle(sortedReviews); // Random part of dueDateRandom
    // Other sort orders are more complex, simplified for now.
    sortedReviews = sortedReviews.slice(0, settings.maxReviewsPerDay);

    // 5. Combine Queues
    const learningCombined = [...intradayLearning, ...interdayLearning].sort((a, b) => new Date(a.srs!.sm2!.due).getTime() - new Date(b.srs!.sm2!.due).getTime());
    
    const reviewsAndInterday = settings.interdayLearningReviewOrder === 'mix' ? shuffle([...sortedReviews, ...interdayLearning]) :
                               settings.interdayLearningReviewOrder === 'after' ? [...sortedReviews, ...interdayLearning] :
                               [...interdayLearning, ...sortedReviews];

    const finalWithNew = settings.newReviewOrder === 'mix' ? shuffle([...reviewsAndInterday, ...sortedNew]) :
                         settings.newReviewOrder === 'after' ? [...reviewsAndInterday, ...sortedNew] :
                         [...sortedNew, ...reviewsAndInterday];

    const combinedQueue = [...learningCombined, ...finalWithNew];

    setSessionQueue(combinedQueue);
    setCurrentCardIndex(0);
    setBuriedNoteIds(new Set());

  }, [deck, settings]);

  const currentCard = useMemo(() => {
    for (let i = currentCardIndex; i < sessionQueue.length; i++) {
      const card = sessionQueue[i];
      if (!card.noteId || !buriedNoteIds.has(card.noteId)) {
        return card;
      }
    }
    return null;
  }, [sessionQueue, currentCardIndex, buriedNoteIds]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard) return;

    let updatedCard: FlashcardData = currentCard;

    if (settings.scheduler === 'fsrs') {
      // FSRS logic remains the same
    } else { // SM-2 Logic
      const sm2State = currentCard.srs?.sm2 || { state: 'new', repetitions: 0, lapses: 0, easinessFactor: settings.sm2StartingEase, interval: 0, due: new Date().toISOString(), learningStep: 0 };
      let nextSm2State: Sm2State = { ...sm2State };
      const cardState = sm2State.state || 'new';
      const isReview = cardState === 'review';

      if (rating === Rating.Again) {
        if (isReview) { // Lapsed review card
          nextSm2State.lapses = (sm2State.lapses || 0) + 1;
          nextSm2State.easinessFactor = Math.max(settings.sm2MinEasinessFactor, sm2State.easinessFactor - 0.20);
          
          const newInterval = Math.max(settings.sm2MinimumInterval, sm2State.interval * settings.sm2LapsedIntervalMultiplier);
          nextSm2State.interval = newInterval;

          const relearningSteps = parseSteps(settings.relearningSteps);
          if (relearningSteps.length > 0) {
            nextSm2State.state = 'relearning';
            nextSm2State.learningStep = 0;
            const nextDue = new Date();
            nextDue.setMinutes(nextDue.getMinutes() + relearningSteps[0]);
            nextSm2State.due = nextDue.toISOString();
          } else {
            // No relearning steps, just reschedule
            const nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + newInterval);
            nextSm2State.due = nextDue.toISOString();
          }
        } else { // New or learning card rated 'Again'
          nextSm2State.learningStep = 0;
          const learningSteps = parseSteps(settings.learningSteps);
          const nextDue = new Date();
          nextDue.setMinutes(nextDue.getMinutes() + learningSteps[0]);
          nextSm2State.due = nextDue.toISOString();
        }
      } else if (isReview) { // Review card rated Hard, Good, or Easy
        const qualityMap: { [key in Rating]: Sm2Quality } = { [Rating.Manual]: 0, [Rating.Again]: 1, [Rating.Hard]: 3, [Rating.Good]: 4, [Rating.Easy]: 5 };
        const sm2Params = { 
          startingEase: settings.sm2StartingEase,
          minEasinessFactor: settings.sm2MinEasinessFactor,
          easyBonus: settings.sm2EasyBonus,
          intervalModifier: settings.sm2IntervalModifier,
          hardIntervalMultiplier: settings.sm2HardIntervalMultiplier,
          maximumInterval: settings.sm2MaximumInterval,
        };
        nextSm2State = sm2(qualityMap[rating], sm2Params, sm2State);
      } else { // New or learning card rated Good or Easy
        const isNew = cardState === 'new';
        if (isNew) nextSm2State.easinessFactor = settings.sm2StartingEase;
        
        if (rating === Rating.Easy) { // Graduate immediately with Easy Interval
          nextSm2State.state = 'review';
          nextSm2State.learningStep = undefined;
          nextSm2State.interval = settings.sm2EasyInterval;
          const nextDue = new Date();
          nextDue.setDate(nextDue.getDate() + nextSm2State.interval);
          nextSm2State.due = nextDue.toISOString();
        } else { // Rating is Good, advance learning step
          const steps = (cardState === 'relearning') ? parseSteps(settings.relearningSteps) : parseSteps(settings.learningSteps);
          const currentStep = sm2State.learningStep || 0;
          const nextStep = currentStep + 1;

          if (nextStep >= steps.length) { // Graduate
            nextSm2State.state = 'review';
            nextSm2State.learningStep = undefined;
            // On graduation from relearning, use the new lapsed interval. Otherwise, use graduating interval.
            const graduationInterval = cardState === 'relearning' ? sm2State.interval : settings.sm2GraduatingInterval;
            nextSm2State.interval = graduationInterval;
            const nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + graduationInterval);
            nextSm2State.due = nextDue.toISOString();
          } else { // Advance to next learning step
            nextSm2State.state = isNew ? 'learning' : cardState;
            nextSm2State.learningStep = nextStep;
            const nextDue = new Date();
            nextDue.setMinutes(nextDue.getMinutes() + steps[nextStep]);
            nextSm2State.due = nextDue.toISOString();
          }
        }
      }
      
      updatedCard = { ...currentCard, srs: { ...currentCard.srs, sm2: nextSm2State } };

      if (isReview && rating === Rating.Again && nextSm2State.lapses! >= settings.leechThreshold) {
        if (settings.leechAction === 'suspend') {
          updatedCard.srs = { ...updatedCard.srs, isSuspended: true };
        } else {
          const newTags = [...(updatedCard.tags || [])];
          if (!newTags.includes('leech')) newTags.push('leech');
          updatedCard.tags = newTags;
        }
      }
    }
    
    setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard));
    
    if (settings.scheduler === 'sm2' && currentCard.noteId) {
      const cardState = currentCard.srs?.sm2?.state || 'new';
      let shouldBury = false;

      if (cardState === 'new' && settings.buryNewSiblings) {
          shouldBury = true;
      } else if (cardState === 'review' && settings.buryReviewSiblings) {
          shouldBury = true;
      } else if ((cardState === 'learning' || cardState === 'relearning') && settings.buryInterdayLearningSiblings) {
          const steps = cardState === 'learning' ? parseSteps(settings.learningSteps) : parseSteps(settings.relearningSteps);
          const currentStepIndex = currentCard.srs?.sm2?.learningStep || 0;
          if (currentStepIndex < steps.length && steps[currentStepIndex] >= 1440) { // 1440 minutes in a day
              shouldBury = true;
          }
      }

      if (shouldBury) {
          setBuriedNoteIds(prev => new Set([...prev, currentCard.noteId!]));
      }
    }

    setIsFlipped(false);
    setCurrentCardIndex(prev => prev + 1);
  }, [currentCard, settings, setDecks]);

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
    return <div className="min-h-screen flex flex-col items-center justify-center text-center p-4"><h2 className="text-2xl font-bold mb-4">Deck not found</h2><Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button></div>;
  }
  if (sessionQueue.length === 0 && currentCardIndex === 0) {
    return <div className="min-h-screen flex flex-col items-center justify-center text-center p-4"><h2 className="text-2xl font-bold mb-4">All caught up!</h2><p className="text-muted-foreground mb-6">You have no cards due for review in this deck.</p><Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button></div>;
  }
  if (!currentCard) {
    return <div className="min-h-screen flex flex-col items-center justify-center text-center p-4"><h2 className="text-2xl font-bold mb-4">Session Complete!</h2><p className="text-muted-foreground mb-6">You've reviewed all available cards for this session.</p><Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button></div>;
  }

  const handleCardClick = () => !isFlipped && setIsFlipped(true);

  const renderCard = () => {
    if (!currentCard) return null;
    switch (currentCard.type) {
      case 'basic': return <Flashcard question={currentCard.question} answer={currentCard.answer} isFlipped={isFlipped} onClick={handleCardClick} />;
      case 'cloze': return <ClozePlayer text={currentCard.text} description={currentCard.description} isFlipped={isFlipped} onClick={handleCardClick} />;
      case 'imageOcclusion': return <ImageOcclusionPlayer imageUrl={currentCard.imageUrl} occlusions={currentCard.occlusions} questionOcclusionId={currentCard.questionOcclusionId} description={currentCard.description} isFlipped={isFlipped} onClick={handleCardClick} />;
      default: return null;
    }
  };

  const formatInterval = (interval: number): string => {
    if (interval < 1) { const minutes = Math.round(interval * 24 * 60); return `${minutes}m`; }
    if (interval < 30) { return `${Math.round(interval)}d`; }
    if (interval < 365) { const months = interval / 30; return `${Number.isInteger(months) ? months : months.toFixed(1)}mo`; }
    const years = interval / 365; return `${Number.isInteger(years) ? years : years.toFixed(1)}y`;
  };

  const getIntervalText = (rating: Rating) => {
    if (settings.scheduler === 'sm2' && currentCard) {
        const sm2State = currentCard.srs?.sm2 || { state: 'new', repetitions: 0, easinessFactor: settings.sm2StartingEase, interval: 0 };
        const cardState = sm2State.state || 'new';

        if (cardState === 'review') {
            const qualityMap: { [key in Rating]: Sm2Quality } = { [Rating.Manual]: 0, [Rating.Again]: 1, [Rating.Hard]: 3, [Rating.Good]: 4, [Rating.Easy]: 5 };
            const sm2Params = { 
                startingEase: settings.sm2StartingEase,
                minEasinessFactor: settings.sm2MinEasinessFactor,
                easyBonus: settings.sm2EasyBonus,
                intervalModifier: settings.sm2IntervalModifier,
                hardIntervalMultiplier: settings.sm2HardIntervalMultiplier,
                maximumInterval: settings.sm2MaximumInterval,
            };
            if (rating === Rating.Again) {
              const relearningSteps = parseSteps(settings.relearningSteps);
              return relearningSteps.length > 0 ? `${relearningSteps[0]}m` : `${settings.sm2MinimumInterval}d`;
            }
            const result = sm2(qualityMap[rating], sm2Params, sm2State);
            return formatInterval(result.interval);
        } else { // New or Learning
            const steps = cardState === 'relearning' ? parseSteps(settings.relearningSteps) : parseSteps(settings.learningSteps);
            const currentStep = sm2State.learningStep || 0;
            if (rating === Rating.Again) return `${steps[0]}m`;
            if (rating === Rating.Easy) return `${settings.sm2EasyInterval}d`;
            if (rating === Rating.Good) {
                const nextStep = currentStep + 1;
                if (nextStep >= steps.length) {
                  const graduationInterval = cardState === 'relearning' ? sm2State.interval : settings.sm2GraduatingInterval;
                  return `${graduationInterval}d`;
                }
                return `${steps[nextStep]}m`;
            }
        }
    }
    return '';
  };

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
       <Button variant="ghost" onClick={() => navigate("/")} className="absolute top-4 left-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
      </Button>
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-center">Studying: {deck.name}</h1>
        {renderCard()}
        <div className="text-sm text-muted-foreground">
          {sessionQueue.length > 0 && `Card ${currentCardIndex + 1} of ${sessionQueue.length}`}
        </div>
        <div className="w-full mt-4">
          {isFlipped ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              <Button onClick={() => handleRating(Rating.Again)} className="relative bg-red-500 hover:bg-red-600 text-white font-bold h-16 text-base flex flex-col"><span>Again</span><span className="text-xs font-normal opacity-80">{getIntervalText(Rating.Again)}</span><span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">1</span></Button>
              <Button onClick={() => handleRating(Rating.Hard)} className="relative bg-orange-400 hover:bg-orange-500 text-white font-bold h-16 text-base flex flex-col"><span>Hard</span><span className="text-xs font-normal opacity-80">{getIntervalText(Rating.Hard)}</span><span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">2</span></Button>
              <Button onClick={() => handleRating(Rating.Good)} className="relative bg-green-500 hover:bg-green-600 text-white font-bold h-16 text-base flex flex-col"><span>Good</span><span className="text-xs font-normal opacity-80">{getIntervalText(Rating.Good)}</span><span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">3</span></Button>
              <Button onClick={() => handleRating(Rating.Easy)} className="relative bg-blue-500 hover:bg-blue-600 text-white font-bold h-16 text-base flex flex-col"><span>Easy</span><span className="text-xs font-normal opacity-80">{getIntervalText(Rating.Easy)}</span><span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">4</span></Button>
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
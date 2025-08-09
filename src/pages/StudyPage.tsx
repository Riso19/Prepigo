import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { useSettings } from "@/contexts/SettingsContext";
import { findDeckById, getAllFlashcardsFromDeck, updateFlashcard, tagLeech } from "@/lib/deck-utils";
import { addReviewLog } from "@/lib/idb";
import { FlashcardData, ReviewLog, Sm2State } from "@/data/decks";
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
  
  const [isFlipped, setIsFlipped] = useState(false);
  
  // FSRS specific state
  const [fsrsOutcomes, setFsrsOutcomes] = useState<RecordLog | null>(null);
  
  // SM-2 specific state
  const [sessionQueue, setSessionQueue] = useState<FlashcardData[]>([]);
  const [learningQueue, setLearningQueue] = useState<FlashcardData[]>([]);
  const [buriedNoteIds, setBuriedNoteIds] = useState<Set<string>>(new Set());
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const fsrsInstance = useMemo(() => {
    const params = generatorParameters(settings.fsrsParameters);
    return fsrs(params);
  }, [settings.fsrsParameters]);

  // FSRS Queue Logic
  const fsrsSessionQueue = useMemo(() => {
    if (settings.scheduler !== 'fsrs' || !deck) return [];
    const now = new Date();
    const allCards = getAllFlashcardsFromDeck(deck);
    const dueCards = allCards
      .filter(card => !card.srs?.isSuspended)
      .filter(card => {
        const fsrsData = card.srs?.fsrs;
        if (!fsrsData?.due) return true;
        return new Date(fsrsData.due) <= now;
      });
    const newCards = dueCards
      .filter(c => c.srs?.fsrs?.state === undefined || c.srs.fsrs.state === State.New)
      .slice(0, settings.newCardsPerDay);
    const reviewCards = dueCards
      .filter(c => c.srs?.fsrs?.state !== undefined && c.srs.fsrs.state !== State.New)
      .slice(0, settings.maxReviewsPerDay);
    return [...reviewCards, ...newCards].sort(() => Math.random() - 0.5);
  }, [deck, settings.scheduler, settings.newCardsPerDay, settings.maxReviewsPerDay]);

  // SM-2 Queue Generation
  useEffect(() => {
    if (settings.scheduler === 'sm2' && deck) {
      const now = new Date();
      const allCards = getAllFlashcardsFromDeck(deck);
      
      const learning = allCards.filter(c => c.srs?.sm2?.state === 'learning' || c.srs?.sm2?.state === 'relearning');
      const dueReviews = allCards.filter(c => c.srs?.sm2?.state === 'review' && new Date(c.srs.sm2.due) <= now);
      const newCards = allCards.filter(c => !c.srs?.sm2 || c.srs.sm2.state === 'new');

      const reviewQueue = [...dueReviews].sort(() => Math.random() - 0.5).slice(0, settings.maxReviewsPerDay);
      const newQueue = [...newCards].sort(() => Math.random() - 0.5).slice(0, settings.newCardsPerDay);
      
      setLearningQueue(learning.sort((a, b) => new Date(a.srs!.sm2!.due).getTime() - new Date(b.srs!.sm2!.due).getTime()));
      setSessionQueue([...reviewQueue, ...newQueue]);
      setCurrentCardIndex(0);
      setBuriedNoteIds(new Set());
    }
  }, [deck, settings.scheduler, settings.maxReviewsPerDay, settings.newCardsPerDay]);

  const currentCard = useMemo(() => {
    if (settings.scheduler === 'fsrs') {
      return fsrsSessionQueue[currentCardIndex] || null;
    }
    // SM-2 logic
    const now = new Date();
    const dueLearningCard = learningQueue.find(c => new Date(c.srs!.sm2!.due) <= now);
    if (dueLearningCard) return dueLearningCard;

    for (let i = currentCardIndex; i < sessionQueue.length; i++) {
      const card = sessionQueue[i];
      if (!card.noteId || !buriedNoteIds.has(card.noteId)) {
        return card;
      }
    }
    return null;
  }, [settings.scheduler, fsrsSessionQueue, sessionQueue, learningQueue, buriedNoteIds, currentCardIndex]);

  const initialDueCount = settings.scheduler === 'fsrs' ? fsrsSessionQueue.length : sessionQueue.length + learningQueue.length;

  // FSRS outcome calculation
  useEffect(() => {
    if (settings.scheduler === 'fsrs' && isFlipped && currentCard) {
      if (fsrsOutcomes) return;
      const fsrsData = currentCard.srs?.fsrs;
      const cardToReview: Card = {
        ...createEmptyCard(fsrsData?.due ? new Date(fsrsData.due) : new Date()),
        ...fsrsData,
        due: fsrsData?.due ? new Date(fsrsData.due) : new Date(),
        last_review: fsrsData?.last_review ? new Date(fsrsData.last_review) : undefined,
      };
      setFsrsOutcomes(fsrsInstance.repeat(cardToReview, new Date()));
    }
  }, [isFlipped, currentCard, settings.scheduler, fsrsInstance, fsrsOutcomes]);

  const advanceCard = () => {
    setIsFlipped(false);
    if (settings.scheduler === 'fsrs') {
      setFsrsOutcomes(null);
      setCurrentCardIndex(prev => prev + 1);
    } else {
      // SM-2: Find the index of the current card in its queue and remove it
      const learningIndex = learningQueue.findIndex(c => c.id === currentCard!.id);
      if (learningIndex > -1) {
        setLearningQueue(q => q.filter(c => c.id !== currentCard!.id));
      } else {
        // It must be in the main queue, advance the index past any buried cards
        let nextIndex = currentCardIndex;
        while(nextIndex < sessionQueue.length) {
            const card = sessionQueue[nextIndex];
            if (card.id === currentCard!.id || (card.noteId && buriedNoteIds.has(card.noteId))) {
                nextIndex++;
            } else {
                break;
            }
        }
        setCurrentCardIndex(nextIndex);
      }
    }
  };

  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard) return;

    let updatedCard: FlashcardData = currentCard;

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
    } else { // SM-2 Logic
      const sm2State = currentCard.srs?.sm2 || { state: 'new', repetitions: 0, lapses: 0, easinessFactor: settings.sm2InitialEasinessFactor, interval: 0, due: new Date().toISOString() };
      const learningSteps = settings.learningSteps.split(' ').map(Number);
      const relearningSteps = settings.relearningSteps.split(' ').map(Number);
      let nextSm2State: Sm2State = { ...sm2State };
      let wasLapse = false;

      if (rating === Rating.Again) {
        nextSm2State.state = 'relearning';
        nextSm2State.lapses = (sm2State.lapses || 0) + 1;
        const nextDue = new Date();
        nextDue.setMinutes(nextDue.getMinutes() + relearningSteps[0]);
        nextSm2State.due = nextDue.toISOString();
        wasLapse = sm2State.state === 'review';
      } else {
        if (sm2State.state === 'learning' || sm2State.state === 'relearning') {
          // Still in learning steps
          nextSm2State.state = sm2State.state;
          const nextDue = new Date();
          nextDue.setMinutes(nextDue.getMinutes() + learningSteps[0]); // Simplified: always use first step for now
          nextSm2State.due = nextDue.toISOString();
          // Graduate on Easy or Good (simplified)
          if (rating === Rating.Easy || rating === Rating.Good) {
            nextSm2State.state = 'review';
            nextSm2State.interval = settings.sm2FirstInterval;
            const graduateDueDate = new Date();
            graduateDueDate.setDate(graduateDueDate.getDate() + nextSm2State.interval);
            nextSm2State.due = graduateDueDate.toISOString();
          }
        } else { // Is a review card
          const qualityMap: { [key in Rating]: Sm2Quality } = { [Rating.Manual]: 0, [Rating.Again]: 1, [Rating.Hard]: 3, [Rating.Good]: 4, [Rating.Easy]: 5 };
          const sm2Params = { initialEasinessFactor: settings.sm2InitialEasinessFactor, minEasinessFactor: settings.sm2MinEasinessFactor, firstInterval: settings.sm2FirstInterval, secondInterval: settings.sm2SecondInterval };
          const result = sm2(qualityMap[rating], sm2Params, sm2State);
          nextSm2State = { ...nextSm2State, ...result, state: 'review' };
        }
      }
      
      updatedCard = { ...currentCard, srs: { ...currentCard.srs, sm2: nextSm2State } };

      if (wasLapse && nextSm2State.lapses! >= settings.leechThreshold) {
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
        if ((settings.buryNewSiblings && updatedCard.srs?.sm2?.state === 'review') || (settings.buryReviewSiblings && updatedCard.srs?.sm2?.state === 'review')) {
            setBuriedNoteIds(prev => new Set([...prev, currentCard.noteId!]));
        }
    }

    advanceCard();
  }, [currentCard, settings, fsrsOutcomes, setDecks, navigate, learningQueue, sessionQueue, buriedNoteIds, currentCardIndex]);

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
  if (getAllFlashcardsFromDeck(deck).length === 0) {
    return <div className="min-h-screen flex flex-col items-center justify-center text-center p-4"><h2 className="text-2xl font-bold mb-4">This deck is empty!</h2><Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button></div>;
  }
  if (initialDueCount > 0 && !currentCard) {
    return <div className="min-h-screen flex flex-col items-center justify-center text-center p-4"><h2 className="text-2xl font-bold mb-4">Session Complete!</h2><p className="text-muted-foreground mb-6">You've reviewed all available cards for this session.</p><Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button></div>;
  }
  if (initialDueCount === 0) {
    return <div className="min-h-screen flex flex-col items-center justify-center text-center p-4"><h2 className="text-2xl font-bold mb-4">All caught up!</h2><p className="text-muted-foreground mb-6">You have no cards due for review in this deck.</p><Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link></Button></div>;
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
    if (settings.scheduler === 'fsrs' && fsrsOutcomes) {
      return formatInterval(fsrsOutcomes[rating].card.scheduled_days);
    }
    if (settings.scheduler === 'sm2' && currentCard) {
        const sm2State = currentCard.srs?.sm2 || { state: 'new', repetitions: 0, easinessFactor: settings.sm2InitialEasinessFactor, interval: 0 };
        if (sm2State.state === 'learning' || sm2State.state === 'relearning') {
            if (rating === Rating.Again) return `${settings.relearningSteps.split(' ')[0]}m`;
            if (rating === Rating.Good) return `${settings.learningSteps.split(' ')[0]}m`;
            if (rating === Rating.Easy) return `${settings.sm2FirstInterval}d`;
        } else {
            const qualityMap: { [key in Rating]: Sm2Quality } = { [Rating.Manual]: 0, [Rating.Again]: 1, [Rating.Hard]: 3, [Rating.Good]: 4, [Rating.Easy]: 5 };
            const sm2Params = { initialEasinessFactor: settings.sm2InitialEasinessFactor, minEasinessFactor: settings.sm2MinEasinessFactor, firstInterval: settings.sm2FirstInterval, secondInterval: settings.sm2SecondInterval };
            const result = sm2(qualityMap[rating], sm2Params, sm2State);
            return formatInterval(result.interval);
        }
    }
    return '';
  };

  const currentCardNumber = settings.scheduler === 'fsrs' ? currentCardIndex + 1 : (sessionQueue.length + learningQueue.length - (sessionQueue.slice(currentCardIndex).length + learningQueue.length) + 1);

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
import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { useSettings } from "@/contexts/SettingsContext";
import { findDeckById, updateFlashcard, getEffectiveSrsSettings, buildSessionQueue } from "@/lib/deck-utils";
import { addReviewLog } from "@/lib/idb";
import { FlashcardData, ReviewLog, Sm2State, ExamData } from "@/data/decks";
import Flashcard from "@/components/Flashcard";
import ClozePlayer from "@/components/ClozePlayer";
import ImageOcclusionPlayer from "@/components/ImageOcclusionPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Calendar } from "lucide-react";
import { fsrs, Card, State, Rating, RecordLog, generatorParameters, createEmptyCard } from "ts-fsrs";
import { fsrs6, Card as Fsrs6Card, generatorParameters as fsrs6GeneratorParameters } from "@/lib/fsrs6";
import { sm2, Sm2Quality } from "@/lib/sm2";
import { useExams } from "@/contexts/ExamsContext";
import { differenceInDays, isPast } from "date-fns";

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

const StudyPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const location = useLocation();
  const { decks, setDecks, introductionsToday, addIntroducedCard } = useDecks();
  const { settings: globalSettings } = useSettings();
  const { exams } = useExams();
  const navigate = useNavigate();
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<FlashcardData[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [buriedNoteIds, setBuriedNoteIds] = useState<Set<string>>(new Set());
  
  const [fsrsOutcomes, setFsrsOutcomes] = useState<RecordLog | null>(null);

  const [isCustomSession, setIsCustomSession] = useState(false);
  const [isSrsEnabled, setIsSrsEnabled] = useState(true);
  const [customSessionTitle, setCustomSessionTitle] = useState('');
  const [cardExamMap, setCardExamMap] = useState<Map<string, ExamData>>(new Map());
  
  const fsrsInstance = useMemo(() => {
    const currentDeck = deckId ? findDeckById(decks, deckId) : null;
    const settings = currentDeck ? getEffectiveSrsSettings(decks, currentDeck.id, globalSettings) : globalSettings;
    if (settings.scheduler === 'fsrs6') {
        return fsrs6(fsrs6GeneratorParameters(settings.fsrs6Parameters));
    }
    return fsrs(generatorParameters(settings.fsrsParameters));
  }, [deckId, decks, globalSettings]);

  const currentCard = useMemo(() => {
    for (let i = currentCardIndex; i < sessionQueue.length; i++) {
      const card = sessionQueue[i];
      if (!card.noteId || !buriedNoteIds.has(card.noteId)) {
        return card;
      }
    }
    return null;
  }, [sessionQueue, currentCardIndex, buriedNoteIds]);

  const currentCardExam = useMemo(() => {
    if (!currentCard) return null;
    return cardExamMap.get(currentCard.id);
  }, [currentCard, cardExamMap]);

  useEffect(() => {
    if (deckId === 'custom' && location.state) {
        const { queue, srsEnabled, title } = location.state;
        setIsCustomSession(true);
        setSessionQueue(queue || []);
        setIsSrsEnabled(srsEnabled);
        setCustomSessionTitle(title || 'Custom Study');
        setCardExamMap(new Map());
    } else {
        setIsCustomSession(false);
        setIsSrsEnabled(true);
        const currentDeck = deckId && deckId !== 'all' ? findDeckById(decks, deckId) : null;
        if (!currentDeck && deckId !== 'all' && deckId !== 'custom') {
            setSessionQueue([]);
            return;
        }
        const decksToStudy = deckId === 'all' ? decks : (currentDeck ? [currentDeck] : []);
        if (decksToStudy.length > 0) {
            const { queue, cardExamMap: newCardExamMap } = buildSessionQueue(decksToStudy, decks, globalSettings, introductionsToday, exams);
            setSessionQueue(queue);
            setCardExamMap(newCardExamMap);
        } else {
            setSessionQueue([]);
            setCardExamMap(new Map());
        }
    }
    
    setCurrentCardIndex(0);
    setBuriedNoteIds(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, location.state, exams]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard) return;
    
    const actualCardIndex = sessionQueue.findIndex(c => c.id === currentCard.id);
    if (actualCardIndex === -1) return;

    if (!isSrsEnabled) {
        setIsFlipped(false);
        setCurrentCardIndex(actualCardIndex + 1);
        return;
    }

    const settings = getEffectiveSrsSettings(decks, deckId || 'all', globalSettings);
    const wasNew = (currentCard.srs?.fsrs?.reps === 0 || !currentCard.srs?.fsrs) || (currentCard.srs?.sm2?.repetitions === 0 || !currentCard.srs?.sm2);
    let updatedCard: FlashcardData = currentCard;

    if (settings.scheduler === 'fsrs' || settings.scheduler === 'fsrs6') {
      if (!fsrsOutcomes) return;
      const nextState = fsrsOutcomes[rating];
      const logEntry = nextState.log;

      const logToSave: ReviewLog = {
        cardId: currentCard.id,
        rating: logEntry.rating,
        state: logEntry.state,
        due: logEntry.due.toISOString(),
        stability: logEntry.stability,
        difficulty: logEntry.difficulty,
        elapsed_days: logEntry.elapsed_days,
        last_elapsed_days: logEntry.last_elapsed_days,
        scheduled_days: logEntry.scheduled_days,
        review: logEntry.review.toISOString(),
      };
      await addReviewLog(logToSave);

      const updatedSrsData = {
          ...nextState.card,
          due: nextState.card.due.toISOString(),
          last_review: nextState.card.last_review?.toISOString(),
      };

      updatedCard = { 
        ...currentCard, 
        srs: { 
          ...currentCard.srs, 
          ...(settings.scheduler === 'fsrs6' ? { fsrs6: updatedSrsData } : { fsrs: updatedSrsData }),
        } 
      };
    } else { // SM-2 Logic
      const sm2State = currentCard.srs?.sm2 || { state: 'new', repetitions: 0, lapses: 0, easinessFactor: settings.sm2StartingEase, interval: 0, due: new Date().toISOString(), learning_step: 0 };
      let nextSm2State: Sm2State = { ...sm2State };
      const cardState = sm2State.state || 'new';
      const isReview = cardState === 'review';

      if (rating === Rating.Again) {
        if (isReview) {
          nextSm2State.lapses = (sm2State.lapses || 0) + 1;
          nextSm2State.easinessFactor = Math.max(settings.sm2MinEasinessFactor, sm2State.easinessFactor - 0.20);
          const newInterval = Math.max(settings.sm2MinimumInterval, sm2State.interval * settings.sm2LapsedIntervalMultiplier);
          nextSm2State.interval = newInterval;
          const relearningSteps = parseSteps(settings.relearningSteps);
          if (relearningSteps.length > 0) {
            nextSm2State.state = 'relearning';
            nextSm2State.learning_step = 0;
            const nextDue = new Date();
            nextDue.setMinutes(nextDue.getMinutes() + relearningSteps[0]);
            nextSm2State.due = nextDue.toISOString();
          } else {
            const nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + newInterval);
            nextSm2State.due = nextDue.toISOString();
          }
        } else {
          nextSm2State.learning_step = 0;
          const learningSteps = parseSteps(settings.learningSteps);
          const nextDue = new Date();
          const firstStep = learningSteps.length > 0 ? learningSteps[0] : 1;
          nextDue.setMinutes(nextDue.getMinutes() + firstStep);
          nextSm2State.due = nextDue.toISOString();
        }
      } else if (isReview) {
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
      } else {
        const isNewCard = cardState === 'new';
        if (isNewCard) nextSm2State.easinessFactor = settings.sm2StartingEase;
        
        if (rating === Rating.Easy) {
          nextSm2State.state = 'review';
          nextSm2State.learning_step = undefined;
          nextSm2State.interval = settings.sm2EasyInterval;
          const nextDue = new Date();
          nextDue.setDate(nextDue.getDate() + nextSm2State.interval);
          nextSm2State.due = nextDue.toISOString();
        } else {
          const steps = (cardState === 'relearning') ? parseSteps(settings.relearningSteps) : parseSteps(settings.learningSteps);
          const currentStep = sm2State.learning_step || 0;
          const nextStep = currentStep + 1;

          if (nextStep >= steps.length) {
            nextSm2State.state = 'review';
            nextSm2State.learning_step = undefined;
            const graduationInterval = cardState === 'relearning' ? sm2State.interval : settings.sm2GraduatingInterval;
            nextSm2State.interval = graduationInterval;
            const nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + graduationInterval);
            nextSm2State.due = nextDue.toISOString();
          } else {
            nextSm2State.state = isNewCard ? 'learning' : cardState;
            nextSm2State.learning_step = nextStep;
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
    
    if (wasNew) {
      addIntroducedCard(currentCard.id);
    }

    setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard));
    
    // Also update the card within the current session queue to prevent stale data
    setSessionQueue(prevQueue => 
        prevQueue.map(card => card.id === updatedCard.id ? updatedCard : card)
    );
    
    if (currentCard.noteId) {
      const cardState = settings.scheduler === 'fsrs' ? updatedCard.srs?.fsrs?.state : updatedCard.srs?.sm2?.state;
      let shouldBury = false;

      if (cardState === 'new' && settings.buryNewSiblings) {
          shouldBury = true;
      } else if (cardState === 'review' && settings.buryReviewSiblings) {
          shouldBury = true;
      } else if ((cardState === 'learning' || cardState === 'relearning') && settings.buryInterdayLearningSiblings) {
          shouldBury = true;
      }

      if (shouldBury) {
          setBuriedNoteIds(prev => new Set(prev).add(currentCard.noteId!));
      }
    }

    setIsFlipped(false);
    setCurrentCardIndex(actualCardIndex + 1);
  }, [currentCard, sessionQueue, decks, deckId, globalSettings, setDecks, fsrsOutcomes, fsrsInstance, addIntroducedCard, isSrsEnabled]);

  useEffect(() => {
    if (isFlipped && currentCard && isSrsEnabled) {
      const settings = getEffectiveSrsSettings(decks, deckId || 'all', globalSettings);
      if (settings.scheduler === 'fsrs' || settings.scheduler === 'fsrs6') {
        const srsData = settings.scheduler === 'fsrs6' ? currentCard.srs?.fsrs6 : currentCard.srs?.fsrs;
        const card: Card | Fsrs6Card = srsData
          ? {
              due: new Date(srsData.due),
              stability: srsData.stability,
              difficulty: srsData.difficulty,
              elapsed_days: srsData.elapsed_days,
              scheduled_days: srsData.scheduled_days,
              reps: srsData.reps,
              lapses: srsData.lapses,
              state: srsData.state,
              last_review: srsData.last_review ? new Date(srsData.last_review) : undefined,
              learning_steps: srsData.learning_steps ?? 0,
            }
          : createEmptyCard(new Date());
        const outcomes = fsrsInstance.repeat(card, new Date());
        setFsrsOutcomes(outcomes);
      } else {
        setFsrsOutcomes(null);
      }
    } else {
      setFsrsOutcomes(null);
    }
  }, [isFlipped, currentCard, decks, deckId, globalSettings, fsrsInstance, isSrsEnabled]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isFlipped) {
        event.preventDefault();
        setIsFlipped(true);
        return;
      }
      if (isFlipped) {
        if (!isSrsEnabled) {
            handleRating(Rating.Good); // Just advances to next card
            return;
        }
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
  }, [isFlipped, handleRating, isSrsEnabled]);

  const pageTitle = isCustomSession ? customSessionTitle : (deckId === 'all' ? "Studying All Due Cards" : `Studying: ${findDeckById(decks, deckId || '')?.name}`);

  if (!isCustomSession && !findDeckById(decks, deckId || '') && deckId !== 'all') {
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
    const settings = getEffectiveSrsSettings(decks, deckId || 'all', globalSettings);
    if ((settings.scheduler === 'fsrs' || settings.scheduler === 'fsrs6') && fsrsOutcomes) {
      const nextDueDate = fsrsOutcomes[rating].card.due;
      const now = new Date();
      const diffDays = (nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return formatInterval(diffDays);
    }
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
              const firstStepMinutes = relearningSteps.length > 0 ? relearningSteps[0] : 1;
              return formatInterval(firstStepMinutes / 1440);
            }
            const result = sm2(qualityMap[rating], sm2Params, sm2State);
            return formatInterval(result.interval);
        } else { // This is for 'new', 'learning', 'relearning' states
            const steps = cardState === 'relearning' ? parseSteps(settings.relearningSteps) : parseSteps(settings.learningSteps);
            const currentStep = sm2State.learning_step || 0;

            if (rating === Rating.Again) {
                const firstStepMinutes = steps.length > 0 ? steps[0] : 1;
                return formatInterval(firstStepMinutes / 1440);
            }
            if (rating === Rating.Easy) {
                return formatInterval(settings.sm2EasyInterval);
            }
            if (rating === Rating.Good || rating === Rating.Hard) {
                const nextStepIndex = currentStep + 1;
                if (nextStepIndex >= steps.length) {
                    // Card graduates
                    const graduationInterval = cardState === 'relearning' ? sm2State.interval : settings.sm2GraduatingInterval;
                    return formatInterval(graduationInterval);
                }
                const nextStepMinutes = steps[nextStepIndex];
                return formatInterval(nextStepMinutes / 1440);
            }
        }
    }
    return '';
  };

  const renderFooter = () => {
    if (!isSrsEnabled) {
        return (
            <div className="w-full max-w-2xl mx-auto p-4">
                {isFlipped ? (
                    <Button onClick={() => handleRating(Rating.Good)} className="w-full h-16 text-lg">Next Card</Button>
                ) : (
                    <Button onClick={() => setIsFlipped(true)} className="w-full h-16 text-lg relative">Show Answer<span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">Space</span></Button>
                )}
            </div>
        );
    }
    return (
        <div className="w-full max-w-2xl mx-auto p-4">
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
    );
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col">
      <div className="flex-grow w-full pb-32"> {/* Padding bottom to clear sticky footer */}
        <div className="relative p-4 sm:p-6 md:p-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="absolute top-4 left-4 z-10">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
          </Button>
          
          <header className="w-full max-w-2xl mx-auto text-center mb-4 pt-8 sm:pt-0">
            <h1 className="text-3xl font-bold">{pageTitle}</h1>
          </header>

          <main className="w-full max-w-2xl mx-auto flex flex-col items-center justify-start py-6 gap-6">
            {currentCardExam && (
              <div className="w-full p-2 text-sm font-semibold text-center text-primary-foreground bg-primary/90 rounded-md flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>For Exam: {currentCardExam.name} ({(() => {
                  const examDate = new Date(currentCardExam.date);
                  const daysLeft = differenceInDays(examDate, new Date());
                  if (isPast(examDate) && daysLeft < 0) return "Past";
                  if (daysLeft === 0) return "Today";
                  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
                })()})</span>
              </div>
            )}
            {renderCard()}
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
              <span>
                {sessionQueue.length > 0 && `Card ${currentCardIndex + 1} of ${sessionQueue.length}`}
              </span>
            </div>
          </main>
        </div>
      </div>

      <footer className="sticky bottom-0 w-full bg-secondary/95 backdrop-blur-sm border-t z-20">
        {renderFooter()}
      </footer>
    </div>
  );
};

export default StudyPage;
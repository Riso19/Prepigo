import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { updateMcq, buildMcqSessionQueue, findQuestionBankById, getEffectiveMcqSrsSettings } from "@/lib/question-bank-utils";
import { McqData, QuestionBankData } from "@/data/questionBanks";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, X, HelpCircle, Clock, Check, Sparkles } from "lucide-react";
import McqPlayer from "@/components/McqPlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fsrs, createEmptyCard, Card as FsrsCard, Rating, State } from "ts-fsrs";
import { fsrs6, Card as Fsrs6Card, generatorParameters as fsrs6GeneratorParameters } from "@/lib/fsrs6";
import { addMcqReviewLog, McqReviewLog } from "@/lib/idb";
import { useSettings } from "@/contexts/SettingsContext";

const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const formatInterval = (interval: number): string => {
    if (interval < 1 / (24 * 60)) return `<1m`;
    if (interval < 1) return `${Math.round(interval * 24 * 60)}m`;
    if (interval < 30) return `${Math.round(interval)}d`;
    if (interval < 365) {
        const months = interval / 30;
        return `${Number.isInteger(months) ? months : months.toFixed(1)}mo`;
    }
    const years = interval / 365;
    return `${Number.isInteger(years) ? years : years.toFixed(1)}y`;
};

const ReviewMcqPage = () => {
  const { bankId } = useParams<{ bankId: string }>();
  const { questionBanks, setQuestionBanks, mcqIntroductionsToday, addIntroducedMcq } = useQuestionBanks();
  const navigate = useNavigate();
  const { settings: globalSettings } = useSettings();

  const [sessionQueue, setSessionQueue] = useState<McqData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
  const [isFinished, setIsFinished] = useState(false);
  const [dueTimeStrings, setDueTimeStrings] = useState<Record<string, string> | null>(null);

  const fsrsInstance = useMemo(() => {
    const settings = getEffectiveMcqSrsSettings(questionBanks, bankId || 'all', globalSettings);
    if (settings.scheduler === 'fsrs6') {
      return fsrs6(fsrs6GeneratorParameters(settings.mcqFsrs6Parameters));
    }
    return fsrs(settings.mcqFsrsParameters);
  }, [bankId, questionBanks, globalSettings]);

  const currentQuestion = useMemo(() => sessionQueue[currentQuestionIndex], [sessionQueue, currentQuestionIndex]);

  useEffect(() => {
    if (questionBanks.length > 0) {
      const banksToReview = bankId && bankId !== 'all' ? [findQuestionBankById(questionBanks, bankId)].filter(Boolean) as QuestionBankData[] : questionBanks;
      if (banksToReview.length > 0) {
        const queue = buildMcqSessionQueue(banksToReview, questionBanks, globalSettings, mcqIntroductionsToday);
        setSessionQueue(queue);
      } else {
        setSessionQueue([]);
      }
    }
  }, [bankId, questionBanks, globalSettings, mcqIntroductionsToday]);

  const handleGradeAndProceed = useCallback(async (rating: Rating) => {
    if (!currentQuestion) return;

    const settings = getEffectiveMcqSrsSettings(questionBanks, bankId || 'all', globalSettings);
    const wasNew = settings.scheduler === 'fsrs6' ? !currentQuestion.srs?.fsrs6 || currentQuestion.srs.fsrs6.state === State.New : !currentQuestion.srs?.fsrs || currentQuestion.srs.fsrs.state === State.New;

    const srsData = settings.scheduler === 'fsrs6' ? currentQuestion.srs?.fsrs6 : currentQuestion.srs?.fsrs;
    const card: FsrsCard | Fsrs6Card = srsData
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

    const schedulingResult = fsrsInstance.repeat(card, new Date());
    const nextState = schedulingResult[rating];

    const logToSave: McqReviewLog = {
      mcqId: currentQuestion.id,
      rating: nextState.log.rating,
      state: nextState.log.state,
      due: nextState.log.due.toISOString(),
      stability: nextState.log.stability,
      difficulty: nextState.log.difficulty,
      elapsed_days: nextState.log.elapsed_days,
      last_elapsed_days: nextState.log.last_elapsed_days,
      scheduled_days: nextState.log.scheduled_days,
      review: nextState.log.review.toISOString(),
    };
    await addMcqReviewLog(logToSave);

    const updatedSrsData = {
        ...nextState.card,
        due: nextState.card.due.toISOString(),
        last_review: nextState.card.last_review?.toISOString(),
    };

    const updatedMcq: McqData = {
      ...currentQuestion,
      srs: {
        ...currentQuestion.srs,
        ...(settings.scheduler === 'fsrs6' ? { fsrs6: updatedSrsData } : { fsrs: updatedSrsData }),
      },
    };
    setQuestionBanks(prevBanks => updateMcq(prevBanks, updatedMcq));

    if (wasNew) {
      addIntroducedMcq(currentQuestion.id);
    }

    if (currentQuestionIndex < sessionQueue.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOptionId(null);
      setIsSubmitted(false);
      setIsAnswerCorrect(null);
    } else {
      setIsFinished(true);
    }
  }, [currentQuestion, currentQuestionIndex, sessionQueue.length, fsrsInstance, setQuestionBanks, bankId, globalSettings, addIntroducedMcq]);

  const handleSelectAndSubmit = useCallback((optionId: string) => {
    if (isSubmitted) return;

    setSelectedOptionId(optionId);
    setIsSubmitted(true);

    const correctOption = currentQuestion.options.find(opt => opt.isCorrect);
    const isCorrect = optionId === correctOption?.id;
    setIsAnswerCorrect(isCorrect);

    if (isCorrect) {
      setSessionStats(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setSessionStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }
  }, [isSubmitted, currentQuestion]);

  useEffect(() => {
    if (isSubmitted && currentQuestion && isAnswerCorrect) {
        const settings = getEffectiveMcqSrsSettings(questionBanks, bankId || 'all', globalSettings);
        const srsData = settings.scheduler === 'fsrs6' ? currentQuestion.srs?.fsrs6 : currentQuestion.srs?.fsrs;
        const card: FsrsCard | Fsrs6Card = srsData
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
        const now = new Date();
        const newDueStrings: Record<string, string> = {};

        const ratings = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];
        ratings.forEach(rating => {
            const nextDueDate = outcomes[rating].card.due;
            const diffDays = (nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            newDueStrings[rating] = formatInterval(diffDays);
        });
        
        setDueTimeStrings(newDueStrings);
    } else {
        setDueTimeStrings(null);
    }
  }, [isSubmitted, currentQuestion, fsrsInstance, bankId, questionBanks, globalSettings, isAnswerCorrect]);

  const handleRestart = useCallback(() => {
    const banksToReview = bankId && bankId !== 'all' ? [findQuestionBankById(questionBanks, bankId)].filter(Boolean) as QuestionBankData[] : questionBanks;
    if (banksToReview.length > 0) {
      const queue = buildMcqSessionQueue(banksToReview, questionBanks, globalSettings, mcqIntroductionsToday);
      setSessionQueue(queue);
    }
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setIsSubmitted(false);
    setIsAnswerCorrect(null);
    setSessionStats({ correct: 0, incorrect: 0 });
    setIsFinished(false);
  }, [bankId, questionBanks, globalSettings, mcqIntroductionsToday]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const target = event.target;
        if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
          return;
        }
      }

      if (isSubmitted && isAnswerCorrect) {
        const ratingMap: { [key: string]: Rating } = {
            '1': Rating.Again, '2': Rating.Hard, '3': Rating.Good, '4': Rating.Easy, '5': Rating.Easy,
        };
        const rating = ratingMap[event.key];
        if (rating !== undefined) {
            event.preventDefault();
            handleGradeAndProceed(rating);
        }
      } else if (!isSubmitted) {
        const keyNumber = parseInt(event.key, 10);
        if (currentQuestion && !isNaN(keyNumber) && keyNumber > 0 && keyNumber <= currentQuestion.options.length) {
          const optionIndex = keyNumber - 1;
          const optionId = currentQuestion.options[optionIndex].id;
          handleSelectAndSubmit(optionId);
          event.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitted, isAnswerCorrect, currentQuestion, handleSelectAndSubmit, handleGradeAndProceed]);

  const pageTitle = bankId && bankId !== 'all' ? `Reviewing: ${findQuestionBankById(questionBanks, bankId)?.name}` : "Reviewing All Due MCQs";

  if (sessionQueue.length === 0 && currentQuestionIndex === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">All Caught Up!</h2>
        <p className="text-muted-foreground mb-6">You have no MCQs due for review.</p>
        <Button asChild><Link to="/question-bank"><Home className="mr-2 h-4 w-4" /> Go back to Question Banks</Link></Button>
      </div>
    );
  }

  if (isFinished) {
    const total = sessionStats.correct + sessionStats.incorrect;
    const percentage = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Session Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-bold">{percentage}%</p>
            <p className="text-muted-foreground">
              You answered {sessionStats.correct} out of {total} questions correctly.
            </p>
            <div className="flex gap-4 pt-4">
              <Button onClick={handleRestart} className="flex-1">Practice Again</Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/question-bank"><Home className="mr-2 h-4 w-4" /> Back to Banks</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gradingButtons = [
    { label: "Wrong", tooltip: "Knew you were wrong or guessed wrong", grade: 1, rating: Rating.Again, icon: X, color: "bg-red-500 hover:bg-red-600" },
    { label: "Unsure", tooltip: "Correct but unsure, or guessed right", grade: 2, rating: Rating.Hard, icon: HelpCircle, color: "bg-yellow-500 hover:bg-yellow-600" },
    { label: "Slow", tooltip: "Correct, but took effort to recall", grade: 3, rating: Rating.Good, icon: Clock, color: "bg-blue-500 hover:bg-blue-600" },
    { label: "Confident", tooltip: "Quick, certain recall", grade: 4, rating: Rating.Easy, icon: Check, color: "bg-green-500 hover:bg-green-600" },
    { label: "Easy", tooltip: "Trivial, effortless recall", grade: 5, rating: Rating.Easy, icon: Sparkles, color: "bg-sky-400 hover:bg-sky-500" },
  ];

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col">
      <div className="flex-grow w-full pb-32">
        <div className="relative p-4 sm:p-6 md:p-8">
          <Button variant="ghost" onClick={() => navigate("/question-bank")} className="absolute top-4 left-4 z-10">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Banks
          </Button>
          <header className="w-full max-w-2xl mx-auto text-center mb-4 pt-8 sm:pt-0">
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            <Progress value={((currentQuestionIndex + 1) / sessionQueue.length) * 100} className="mt-4 h-2" />
          </header>
          <main className="w-full max-w-2xl mx-auto flex flex-col items-center justify-start py-6 gap-6">
            {currentQuestion && (
              <McqPlayer
                mcq={currentQuestion}
                selectedOptionId={selectedOptionId}
                isSubmitted={isSubmitted}
                onOptionSelect={handleSelectAndSubmit}
              />
            )}
          </main>
        </div>
      </div>
      <footer className="sticky bottom-0 w-full bg-secondary/95 backdrop-blur-sm border-t z-20">
        <div className="w-full max-w-2xl mx-auto p-4">
          {isSubmitted ? (
            isAnswerCorrect ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                {gradingButtons.map(({ label, tooltip, grade, rating, icon: Icon, color }) => (
                  <Tooltip key={grade}>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => handleGradeAndProceed(rating)}
                        className={`h-16 text-sm flex-col gap-1 text-white font-bold relative ${color}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                        {dueTimeStrings && <span className="text-xs font-normal opacity-80">{dueTimeStrings[rating]}</span>}
                        <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">{grade}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center">
                <Button
                  onClick={() => handleGradeAndProceed(Rating.Again)}
                  className="w-full h-16 text-lg bg-red-500 hover:bg-red-600 text-white font-bold"
                >
                  Continue
                </Button>
              </div>
            )
          ) : (
            <div className="h-16" />
          )}
        </div>
      </footer>
    </div>
  );
};

export default ReviewMcqPage;
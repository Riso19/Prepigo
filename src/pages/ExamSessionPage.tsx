import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { McqData } from '@/data/questionBanks';
import { ExamLogEntry } from '@/data/examLogs';
import { addMcqReviewLog, McqReviewLog, enqueueCriticalSyncOp } from '@/lib/idb';
import { saveExamLogToDB, ExamLog } from '@/lib/dexie-db';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, Flag, ArrowLeft, ArrowRight, CheckSquare, Pause, Eraser, Eye } from 'lucide-react';
import McqPlayer from '@/components/McqPlayer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PauseOverlay } from '@/components/PauseOverlay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExamTracker } from '@/components/ExamTracker';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getEffectiveMcqSrsSettings, updateMcq } from '@/lib/question-bank-utils';
import { fsrs, createEmptyCard, Card as FsrsCard, Rating } from 'ts-fsrs';
import {
  fsrs6,
  Card as Fsrs6Card,
  generatorParameters as fsrs6GeneratorParameters,
} from '@/lib/fsrs6';
import { scheduleSyncNow } from '@/lib/sync';
import { postMessage } from '@/lib/broadcast';

const parseSteps = (steps: string): number[] => {
  return steps
    .trim()
    .split(/\s+/)
    .filter((s) => s)
    .map((stepStr) => {
      const value = parseFloat(stepStr);
      if (isNaN(value)) return 1;
      if (stepStr.endsWith('d')) return value * 24 * 60;
      if (stepStr.endsWith('h')) return value * 60;
      if (stepStr.endsWith('s')) return Math.max(1, value / 60);
      return value;
    });
};

const ReviewGrid = ({
  queue,
  answers,
  marked,
  onNavigate,
  onSubmit,
}: {
  queue: McqData[];
  answers: Record<number, string | null>;
  marked: Set<number>;
  onNavigate: (index: number) => void;
  onSubmit: () => void;
}) => {
  const answeredCount = Object.values(answers).filter((a) => a !== null).length;
  const unansweredCount = queue.length - answeredCount;
  const markedCount = marked.size;

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Exam Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center mb-6">
          <div>
            <p className="font-bold text-green-600">{answeredCount}</p>
            <p className="text-sm text-muted-foreground">Answered</p>
          </div>
          <div>
            <p className="font-bold text-red-600">{unansweredCount}</p>
            <p className="text-sm text-muted-foreground">Unanswered</p>
          </div>
          <div>
            <p className="font-bold text-yellow-600">{markedCount}</p>
            <p className="text-sm text-muted-foreground">Marked</p>
          </div>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 py-4">
          {queue.map((_, index) => {
            const isAnswered = answers[index] !== undefined && answers[index] !== null;
            const isMarked = marked.has(index);
            return (
              <Button
                key={index}
                variant={isAnswered ? 'secondary' : 'outline'}
                className={cn('h-10 w-10 relative', isMarked && 'ring-2 ring-yellow-500')}
                onClick={() => onNavigate(index)}
              >
                {index + 1}
              </Button>
            );
          })}
        </div>
        <div className="mt-8 flex justify-end">
          <Button onClick={onSubmit} className="bg-green-600 hover:bg-green-700">
            <CheckSquare className="mr-2 h-4 w-4" /> Submit Final Exam
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const ExamSessionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { queue, examSettings, srsEnabled } = location.state || {};
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const { settings: globalSettings } = useSettings();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | null>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(examSettings?.timeLimit * 60 || 0);
  const [isSubmitAlertOpen, setIsSubmitAlertOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isReviewScreen, setIsReviewScreen] = useState(false);

  const fsrsInstance = useMemo(() => {
    if (!examSettings) return null;
    const settings = getEffectiveMcqSrsSettings(questionBanks, 'all', globalSettings);
    if (settings.scheduler === 'fsrs6') {
      const steps = {
        learning: parseSteps(settings.learningSteps),
        relearning: parseSteps(settings.relearningSteps),
      };
      return fsrs6(fsrs6GeneratorParameters(settings.mcqFsrs6Parameters), steps);
    }
    return fsrs(settings.mcqFsrsParameters);
  }, [questionBanks, globalSettings, examSettings]);

  useEffect(() => {
    if (!queue || !examSettings) {
      toast.error('Could not start exam. Invalid settings.');
      navigate('/mcq-practice/setup');
    }
  }, [queue, examSettings, navigate]);

  useEffect(() => {
    if (isPaused || isReviewScreen) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, isReviewScreen]);

  const handleSelectOption = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: optionId }));
  };

  const handleClearAnswer = () => {
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[currentQuestionIndex];
      return newAnswers;
    });
  };

  const handleMark = () => {
    setMarked((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestionIndex)) newSet.delete(currentQuestionIndex);
      else newSet.add(currentQuestionIndex);
      return newSet;
    });
  };

  const handleNavigateFromReview = (index: number) => {
    setCurrentQuestionIndex(index);
    setIsReviewScreen(false);
  };

  const handleSubmit = useCallback(
    async (isTimeUp = false) => {
      const timeTaken = examSettings.timeLimit * 60 - timeLeft;
      let correctCount = 0;
      let incorrectCount = 0;
      let skippedCount = 0;

      const entries: ExamLogEntry[] = queue.map((mcq: McqData, index: number) => {
        const selectedOptionId = answers[index] || null;
        const correctOption = mcq.options.find((opt) => opt.isCorrect);
        const isCorrect = selectedOptionId === correctOption?.id;
        let status: ExamLogEntry['status'] = 'skipped';

        if (selectedOptionId) {
          status = 'answered';
          if (isCorrect) correctCount++;
          else incorrectCount++;
        } else {
          skippedCount++;
        }

        if (marked.has(index)) status = 'marked';

        return { mcq, selectedOptionId, isCorrect, status };
      });

      if (srsEnabled && fsrsInstance) {
        const settings = getEffectiveMcqSrsSettings(questionBanks, 'all', globalSettings);
        let updatedBanks = questionBanks;

        for (const entry of entries) {
          if (entry.status === 'answered') {
            const rating = entry.isCorrect ? Rating.Good : Rating.Again;
            const mcq = entry.mcq;

            const srsData = settings.scheduler === 'fsrs6' ? mcq.srs?.fsrs6 : mcq.srs?.fsrs;
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
              mcqId: mcq.id,
              rating: nextState.log.rating,
              state: nextState.log.state,
              due: nextState.log.due.toISOString(),
              stability: nextState.log.stability,
              difficulty: nextState.log.difficulty,
              elapsed_days: nextState.log.elapsed_days,
              last_elapsed_days: nextState.log.last_elapsed_days,
              scheduled_days: nextState.log.scheduled_days,
              review: nextState.log.review.toISOString(),
              duration: 0,
            };
            await addMcqReviewLog(logToSave);

            const updatedSrsData = {
              ...nextState.card,
              due: nextState.card.due.toISOString(),
              last_review: nextState.card.last_review?.toISOString(),
            };
            const updatedMcq: McqData = {
              ...mcq,
              srs: {
                ...mcq.srs,
                ...(settings.scheduler === 'fsrs6'
                  ? { fsrs6: updatedSrsData }
                  : { fsrs: updatedSrsData }),
              },
            };
            updatedBanks = updateMcq(updatedBanks, updatedMcq);
          }
        }
        setQuestionBanks(updatedBanks);
      }

      const score =
        correctCount * examSettings.marksPerCorrect -
        incorrectCount * examSettings.negativeMarksPerWrong;

      const now = Date.now();
      // Create answers record from user responses
      const answersRecord: Record<string, string> = {};
      Object.entries(answers).forEach(([key, value]) => {
        if (value !== null) {
          answersRecord[key] = value;
        }
      });

      const examLog: ExamLog = {
        id: `examlog-${now}`,
        examId: examSettings.id || 'unknown',
        userId: 'current-user', // TODO: Replace with actual user ID from auth context
        answers: answersRecord,
        score,
        totalQuestions: queue.length,
        completed: true,
        startedAt: now - timeTaken * 1000, // Convert seconds to ms
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
        // Enriched fields for results rendering (optional in type; persisted when available)
        name: examSettings.name ?? undefined,
        date: new Date(now).toISOString(),
        settings: {
          timeLimit: examSettings.timeLimit ?? 0,
          totalQuestions: queue.length,
          marksPerCorrect: examSettings.marksPerCorrect ?? 1,
          negativeMarksPerWrong: examSettings.negativeMarksPerWrong ?? 0,
        },
        results: {
          score,
          correctCount,
          incorrectCount,
          skippedCount,
          timeTaken,
        },
        entries,
      };

      await saveExamLogToDB(examLog);
      // Enqueue sync for exam logs (non-blocking) and schedule background sync
      void enqueueCriticalSyncOp({ resource: 'examLogs', opType: 'create', payload: examLog })
        .then(() => scheduleSyncNow())
        .then(() => postMessage({ type: 'storage-write', resource: 'examLogs' }))
        .catch(() => {
          /* noop */
        });
      if (isTimeUp) toast.info("Time's up! Your exam has been submitted.");
      navigate(`/exam/results/${examLog.id}`);
    },
    [
      answers,
      marked,
      queue,
      examSettings,
      timeLeft,
      navigate,
      srsEnabled,
      questionBanks,
      globalSettings,
      fsrsInstance,
      setQuestionBanks,
    ],
  );

  if (!queue || !examSettings) return null;

  const currentQuestion = queue[currentQuestionIndex];
  const answeredCount = Object.values(answers).filter((a) => a !== null).length;

  return (
    <div className="min-h-screen flex flex-col relative">
      {isPaused && <PauseOverlay onResume={() => setIsPaused(false)} />}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-10">
        <div className="container mx-auto p-4 flex justify-between items-center">
          <h1 className="text-lg font-bold truncate">{examSettings.name}</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsPaused(true)}>
              <Pause className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 font-mono text-lg">
              <Clock className="h-5 w-5" />
              <span>
                {Math.floor(timeLeft / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-[73px] bg-background/95 backdrop-blur-sm z-10 py-2 border-b">
        <div className="container mx-auto">
          <ExamTracker
            queue={queue}
            answers={answers}
            marked={marked}
            currentIndex={currentQuestionIndex}
            onNavigate={(index) => setCurrentQuestionIndex(index)}
          />
        </div>
      </div>

      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center">
        {isReviewScreen ? (
          <ReviewGrid
            queue={queue}
            answers={answers}
            marked={marked}
            onNavigate={handleNavigateFromReview}
            onSubmit={() => setIsSubmitAlertOpen(true)}
          />
        ) : (
          <div className="w-full max-w-3xl">
            <McqPlayer
              mcq={currentQuestion}
              selectedOptionId={answers[currentQuestionIndex] || null}
              isSubmitted={false}
              onOptionSelect={handleSelectOption}
              isExamMode
            />
          </div>
        )}
      </main>
      {!isReviewScreen && (
        <footer className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t p-4">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleMark}>
                <Flag
                  className={cn(
                    'mr-2 h-4 w-4',
                    marked.has(currentQuestionIndex) && 'fill-yellow-400 text-yellow-500',
                  )}
                />
                {marked.has(currentQuestionIndex) ? 'Unmark' : 'Mark'}
              </Button>
              <Button variant="destructive" onClick={handleClearAnswer}>
                <Eraser className="mr-2 h-4 w-4" /> Clear
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setCurrentQuestionIndex((p) => Math.max(0, p - 1))}
                disabled={currentQuestionIndex === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              {currentQuestionIndex < queue.length - 1 ? (
                <Button
                  onClick={() => setCurrentQuestionIndex((p) => Math.min(queue.length - 1, p + 1))}
                >
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => setIsReviewScreen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Eye className="mr-2 h-4 w-4" /> Review & Submit
                </Button>
              )}
            </div>
          </div>
        </footer>
      )}
      <AlertDialog open={isSubmitAlertOpen} onOpenChange={setIsSubmitAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {queue.length} questions. Are you sure you
              want to end the exam?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSubmit()}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExamSessionPage;

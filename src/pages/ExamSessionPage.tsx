import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { McqData } from '@/data/questionBanks';
import { ExamLog, ExamLogEntry } from '@/data/examLogs';
import { saveExamLogToDB } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Clock, Flag, ArrowLeft, ArrowRight, CheckSquare, Pause, Eraser, Eye } from 'lucide-react';
import McqPlayer from '@/components/McqPlayer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PauseOverlay } from '@/components/PauseOverlay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExamTracker } from '@/components/ExamTracker';

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
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = queue.length - answeredCount;
  const markedCount = marked.size;

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Exam Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center mb-6">
          <div><p className="font-bold text-green-600">{answeredCount}</p><p className="text-sm text-muted-foreground">Answered</p></div>
          <div><p className="font-bold text-red-600">{unansweredCount}</p><p className="text-sm text-muted-foreground">Unanswered</p></div>
          <div><p className="font-bold text-yellow-600">{markedCount}</p><p className="text-sm text-muted-foreground">Marked</p></div>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 py-4">
          {queue.map((_, index) => {
            const isAnswered = answers[index] !== undefined && answers[index] !== null;
            const isMarked = marked.has(index);
            return (
              <Button
                key={index}
                variant={isAnswered ? 'secondary' : 'outline'}
                className={cn("h-10 w-10 relative", isMarked && "ring-2 ring-yellow-500")}
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
  const { queue, examSettings } = location.state || {};

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | null>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(examSettings?.timeLimit * 60 || 0);
  const [isSubmitAlertOpen, setIsSubmitAlertOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isReviewScreen, setIsReviewScreen] = useState(false);

  useEffect(() => {
    if (!queue || !examSettings) {
      toast.error("Could not start exam. Invalid settings.");
      navigate('/mcq-practice/setup');
    }
  }, [queue, examSettings, navigate]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const handleSelectOption = (optionId: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestionIndex]: optionId }));
  };

  const handleClearAnswer = () => {
    setAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[currentQuestionIndex];
      return newAnswers;
    });
  };

  const handleMark = () => {
    setMarked(prev => {
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

  const handleSubmit = useCallback((isTimeUp = false) => {
    const timeTaken = (examSettings.timeLimit * 60) - timeLeft;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const entries: ExamLogEntry[] = queue.map((mcq: McqData, index: number) => {
      const selectedOptionId = answers[index] || null;
      const correctOption = mcq.options.find(opt => opt.isCorrect);
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

    const score = (correctCount * examSettings.marksPerCorrect) - (incorrectCount * examSettings.negativeMarksPerWrong);

    const examLog: ExamLog = {
      id: `examlog-${Date.now()}`,
      name: examSettings.name,
      date: new Date().toISOString(),
      settings: {
        timeLimit: examSettings.timeLimit,
        totalQuestions: queue.length,
        marksPerCorrect: examSettings.marksPerCorrect,
        negativeMarksPerWrong: examSettings.negativeMarksPerWrong,
      },
      results: { score, correctCount, incorrectCount, skippedCount, timeTaken },
      entries,
    };

    saveExamLogToDB(examLog).then(() => {
      if (isTimeUp) toast.info("Time's up! Your exam has been submitted.");
      navigate(`/exam/results/${examLog.id}`);
    });
  }, [answers, marked, queue, examSettings, timeLeft, navigate]);

  if (!queue || !examSettings) return null;

  const currentQuestion = queue[currentQuestionIndex];
  const answeredCount = Object.keys(answers).filter(k => answers[parseInt(k)] !== null).length;

  return (
    <div className="min-h-screen flex flex-col relative">
      {isPaused && <PauseOverlay onResume={() => setIsPaused(false)} />}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-10">
        <div className="container mx-auto p-4 flex justify-between items-center">
          <h1 className="text-lg font-bold truncate">{examSettings.name}</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsPaused(true)}><Pause className="h-5 w-5" /></Button>
            <div className="flex items-center gap-2 font-mono text-lg">
              <Clock className="h-5 w-5" />
              <span>{Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{ (timeLeft % 60).toString().padStart(2, '0')}</span>
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
          <ReviewGrid queue={queue} answers={answers} marked={marked} onNavigate={handleNavigateFromReview} onSubmit={() => setIsSubmitAlertOpen(true)} />
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
                <Flag className={cn("mr-2 h-4 w-4", marked.has(currentQuestionIndex) && "fill-yellow-400 text-yellow-500")} />
                {marked.has(currentQuestionIndex) ? 'Unmark' : 'Mark'}
              </Button>
              <Button variant="destructive" onClick={handleClearAnswer}><Eraser className="mr-2 h-4 w-4" /> Clear</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCurrentQuestionIndex(p => Math.max(0, p - 1))} disabled={currentQuestionIndex === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              {currentQuestionIndex < queue.length - 1 ? (
                <Button onClick={() => setCurrentQuestionIndex(p => Math.min(queue.length - 1, p + 1))}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => setIsReviewScreen(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Eye className="mr-2 h-4 w-4" /> Review & Submit
                </Button>
              )}
            </div>
          </div>
        </footer>
      )}
      <AlertDialog open={isSubmitAlertOpen} onOpenChange={setIsSubmitAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {queue.length} questions. Are you sure you want to end the exam?
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
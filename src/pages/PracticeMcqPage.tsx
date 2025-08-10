import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { findQuestionBankById, getAllMcqsFromBank } from "@/lib/question-bank-utils";
import { McqData } from "@/data/questionBanks";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import McqPlayer from "@/components/McqPlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const PracticeMcqPage = () => {
  const { bankId } = useParams<{ bankId: string }>();
  const { questionBanks } = useQuestionBanks();
  const navigate = useNavigate();

  const [sessionQueue, setSessionQueue] = useState<McqData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
  const [isFinished, setIsFinished] = useState(false);

  const bank = useMemo(() => (bankId && bankId !== 'all' ? findQuestionBankById(questionBanks, bankId) : null), [questionBanks, bankId]);
  const currentQuestion = useMemo(() => sessionQueue[currentQuestionIndex], [sessionQueue, currentQuestionIndex]);

  useEffect(() => {
    if (!bank && bankId !== 'all') return;

    const banksToPractice = bankId === 'all' ? questionBanks : (bank ? [bank] : []);
    if (banksToPractice.length > 0) {
      const allMcqs = banksToPractice.flatMap(b => getAllMcqsFromBank(b));
      setSessionQueue(shuffle(allMcqs));
    }
  }, [bankId, bank, questionBanks]);

  const handleSubmit = () => {
    if (!selectedOptionId) return;
    const correctOption = currentQuestion.options.find(opt => opt.isCorrect);
    if (selectedOptionId === correctOption?.id) {
      setSessionStats(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setSessionStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }
    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (currentQuestionIndex < sessionQueue.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOptionId(null);
      setIsSubmitted(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    setSessionQueue(shuffle(sessionQueue));
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setIsSubmitted(false);
    setSessionStats({ correct: 0, incorrect: 0 });
    setIsFinished(false);
  };

  const pageTitle = bankId === 'all' ? "Practicing All MCQs" : `Practicing: ${bank?.name}`;

  if (sessionQueue.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">No Questions Found</h2>
        <p className="text-muted-foreground mb-6">This question bank has no MCQs to practice.</p>
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

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col">
      <div className="flex-grow w-full pb-32">
        <div className="relative p-4 sm:p-6 md:p-8">
          <Button variant="ghost" onClick={() => navigate("/question-bank")} className="absolute top-4 left-4 z-10">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Banks
          </Button>
          <header className="w-full max-w-2xl mx-auto text-center mb-4 pt-8 sm:pt-0">
            <h1 className="text-3xl font-bold">{pageTitle}</h1>
            <Progress value={((currentQuestionIndex + 1) / sessionQueue.length) * 100} className="mt-4" />
          </header>
          <main className="w-full max-w-2xl mx-auto flex flex-col items-center justify-start py-6 gap-6">
            <McqPlayer
              mcq={currentQuestion}
              selectedOptionId={selectedOptionId}
              isSubmitted={isSubmitted}
              onOptionSelect={setSelectedOptionId}
            />
          </main>
        </div>
      </div>
      <footer className="sticky bottom-0 w-full bg-secondary/95 backdrop-blur-sm border-t z-20">
        <div className="w-full max-w-2xl mx-auto p-4">
          {isSubmitted ? (
            <Button onClick={handleNext} className="w-full h-16 text-lg">
              {currentQuestionIndex === sessionQueue.length - 1 ? "Finish Session" : "Next Question"}
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!selectedOptionId} className="w-full h-16 text-lg">
              Check Answer
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default PracticeMcqPage;
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useExams } from '@/contexts/ExamsContext';
import { useDecks } from '@/contexts/DecksContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Home, Calendar, BookOpen } from 'lucide-react';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { ExamData, ExamScheduleItem } from '@/data/exams';
import { findFlashcardById } from '@/lib/deck-utils';
import { cn } from '@/lib/utils';
import Header from '@/components/Header';

const DailyScheduleItem = ({ day, exam }: { day: ExamScheduleItem, exam: ExamData }) => {
  const navigate = useNavigate();
  const { decks } = useDecks();
  const date = parseISO(day.date);
  const progress = day.cardIds.length > 0 ? (day.completedCardIds.length / day.cardIds.length) * 100 : 100;
  const isCompleted = progress === 100;

  const handleStudy = () => {
    const cardsToStudy = day.cardIds
      .map(id => findFlashcardById(decks, id)?.flashcard)
      .filter(Boolean);

    if (cardsToStudy.length === 0) return;

    navigate('/study/custom', {
      state: {
        queue: cardsToStudy,
        srsEnabled: exam.studyMode === 'srs',
        title: `Exam Study: ${format(date, 'PPP')}`,
        examId: exam.id,
        scheduleDate: day.date,
        cardIdsForCompletion: day.cardIds,
      }
    });
  };

  return (
    <div className={cn(
      "p-4 border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
      isToday(date) && "border-primary",
      isPast(date) && !isCompleted && "bg-destructive/10 border-destructive/50",
      isCompleted && "bg-green-500/10 border-green-500/50"
    )}>
      <div className="flex-grow">
        <p className="font-semibold">{format(date, 'EEEE, PPP')}</p>
        <div className="flex items-center gap-4 mt-2">
          <Progress value={progress} className="w-full sm:w-48 h-2" />
          <span className="text-sm text-muted-foreground font-medium">
            {day.completedCardIds.length} / {day.cardIds.length}
          </span>
        </div>
      </div>
      <Button onClick={handleStudy} disabled={isCompleted || day.cardIds.length === 0}>
        <BookOpen className="mr-2 h-4 w-4" />
        {isCompleted ? 'Completed' : 'Study'}
      </Button>
    </div>
  );
};

const ExamDetailPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const { exams } = useExams();
  const navigate = useNavigate();

  const exam = exams.find(e => e.id === examId);

  if (!exam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">Exam Schedule Not Found</h2>
        <Button asChild>
          <Link to="/exams"><Home className="mr-2 h-4 w-4" /> Back to Exams</Link>
        </Button>
      </div>
    );
  }

  const totalCards = exam.schedule.reduce((acc, day) => acc + day.cardIds.length, 0);
  const completedCards = exam.schedule.reduce((acc, day) => acc + day.completedCardIds.length, 0);
  const overallProgress = totalCards > 0 ? (completedCards / totalCards) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="w-full max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/exams")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Exams
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">{exam.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 pt-2">
                <Calendar className="h-4 w-4" />
                Exam Date: {format(parseISO(exam.examDate), 'PPP')}
              </CardDescription>
              <div className="pt-4 space-y-2">
                <div className="flex justify-between text-sm font-medium text-muted-foreground">
                  <span>Overall Progress</span>
                  <span>{completedCards} / {totalCards} cards</span>
                </div>
                <Progress value={overallProgress} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-xl font-semibold">Daily Schedule</h3>
              {exam.schedule.map(day => (
                <DailyScheduleItem key={day.date} day={day} exam={exam} />
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ExamDetailPage;
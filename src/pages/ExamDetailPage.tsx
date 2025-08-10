import { useParams, useNavigate, Link } from 'react-router-dom';
import { useExams } from '@/contexts/ExamsContext';
import { useDecks } from '@/contexts/DecksContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Home, Calendar as CalendarIcon, BookOpen } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { getAllFlashcardsFromDeck, findDeckById } from '@/lib/deck-utils';
import Header from '@/components/Header';
import { useMemo } from 'react';

const ExamDetailPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const { exams } = useExams();
  const { decks } = useDecks();
  const navigate = useNavigate();

  const exam = exams.find(e => e.id === examId);

  const { allExamCards, masteredCardsCount, progress } = useMemo(() => {
    if (!exam) return { allExamCards: [], masteredCardsCount: 0, progress: 0 };

    let cards = exam.targetDeckIds.flatMap(deckId => {
      const deck = findDeckById(decks, deckId);
      return deck ? getAllFlashcardsFromDeck(deck) : [];
    });
    cards = [...new Map(cards.map(item => [item.id, item])).values()];

    if (exam.targetTags.length > 0) {
      cards = cards.filter(card => 
        exam.targetTags.every(tag => card.tags?.includes(tag))
      );
    }
    
    const examDate = parseISO(exam.examDate);
    const mastered = cards.filter(c => {
      const srsData = c.srs?.fsrs || c.srs?.fsrs6 || c.srs?.sm2;
      return srsData && isAfter(parseISO(srsData.due), examDate);
    }).length;

    const progressPercentage = cards.length > 0 ? (mastered / cards.length) * 100 : 0;

    return { allExamCards: cards, masteredCardsCount: mastered, progress: progressPercentage };
  }, [exam, decks]);

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
                <CalendarIcon className="h-4 w-4" />
                Exam Date: {format(parseISO(exam.examDate), 'PPP')}
              </CardDescription>
              <div className="pt-4 space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Mastery Progress</span>
                  <span className="text-muted-foreground">{masteredCardsCount} / {allExamCards.length} cards</span>
                </div>
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  A card is "mastered" when its next review is scheduled after the exam date.
                </p>
              </div>
            </CardHeader>
            <CardContent className="text-center">
              <Button size="lg" asChild>
                <Link to="/study/all">
                  <BookOpen className="mr-2 h-5 w-5" />
                  Study Now
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                The "Study Now" queue will automatically prioritize cards for this exam.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ExamDetailPage;
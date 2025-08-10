import { ExamData } from '@/data/exams';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Calendar, Trash2, Pencil } from 'lucide-react';
import { format, differenceInDays, parseISO, isAfter } from 'date-fns';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { findDeckById, getAllFlashcardsFromDeck } from '@/lib/deck-utils';

interface ExamItemProps {
  exam: ExamData;
  onDelete: (examId: string) => void;
}

export const ExamItem = ({ exam, onDelete }: ExamItemProps) => {
  const { decks } = useDecks();

  const { totalCards, masteredCards, progress } = useMemo(() => {
    if (!exam) return { totalCards: 0, masteredCards: 0, progress: 0 };

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
      return srsData && srsData.due && isAfter(parseISO(srsData.due), examDate);
    }).length;

    const progressPercentage = cards.length > 0 ? (mastered / cards.length) * 100 : 0;

    return { totalCards: cards.length, masteredCards: mastered, progress: progressPercentage };
  }, [exam, decks]);

  const examDate = parseISO(exam.examDate);
  const daysLeft = differenceInDays(examDate, new Date());

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{exam.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 pt-1">
              <Calendar className="h-4 w-4" />
              {format(examDate, 'PPP')} ({daysLeft >= 0 ? `${daysLeft} days left` : 'Past'})
            </CardDescription>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/exams/edit/${exam.id}`}>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(exam.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Mastery Progress</span>
            <span>{masteredCards} / {totalCards} cards</span>
          </div>
          <Progress value={progress} />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" asChild>
          <Link to={`/exams/${exam.id}`}>View Details & Study</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
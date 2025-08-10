import { ExamData } from '@/data/exams';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Calendar, Trash2 } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

interface ExamItemProps {
  exam: ExamData;
  onDelete: (examId: string) => void;
}

export const ExamItem = ({ exam, onDelete }: ExamItemProps) => {
  const totalCards = exam.schedule.reduce((acc, day) => acc + day.cardIds.length, 0);
  const completedCards = exam.schedule.reduce((acc, day) => acc + day.completedCardIds.length, 0);
  const progress = totalCards > 0 ? (completedCards / totalCards) * 100 : 0;
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
          <Button variant="ghost" size="icon" onClick={() => onDelete(exam.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{completedCards} / {totalCards} cards</span>
          </div>
          <Progress value={progress} />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" asChild>
          <Link to={`/exams/${exam.id}`}>View Schedule & Study</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
import { Calendar } from '@/components/ui/calendar';
import { ExamData } from '@/data/exams';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useDecks } from '@/contexts/DecksContext';
import { findFlashcardById } from '@/lib/deck-utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ExamCalendarViewProps {
  exam: ExamData;
}

export const ExamCalendarView = ({ exam }: ExamCalendarViewProps) => {
  const navigate = useNavigate();
  const { decks } = useDecks();
  const scheduleMap = new Map(exam.schedule.map(day => [day.date, day]));
  const examDate = parseISO(exam.examDate);

  const handleDayClick = (day: Date) => {
    const dateString = format(day, 'yyyy-MM-dd');
    const scheduleItem = scheduleMap.get(dateString);

    if (!scheduleItem || scheduleItem.cardIds.length === 0) {
      toast.info("No cards scheduled for this day.");
      return;
    }

    const cardsToStudy = scheduleItem.cardIds
      .map(id => findFlashcardById(decks, id)?.flashcard)
      .filter(Boolean);

    if (cardsToStudy.length === 0) {
      toast.error("Could not find the cards for this session.");
      return;
    }

    navigate('/study/custom', {
      state: {
        queue: cardsToStudy,
        srsEnabled: exam.studyMode === 'srs',
        title: `Exam Study: ${format(day, 'PPP')}`,
        examId: exam.id,
        scheduleDate: scheduleItem.date,
        cardIdsForCompletion: scheduleItem.cardIds,
      }
    });
  };

  const DayContent = ({ date }: { date: Date }) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const dayData = scheduleMap.get(dateString);

    if (!dayData || dayData.cardIds.length === 0) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          {date.getDate()}
        </div>
      );
    }

    const isCompleted = dayData.completedCardIds.length >= dayData.cardIds.length;
    const progress = dayData.cardIds.length > 0 ? (dayData.completedCardIds.length / dayData.cardIds.length) * 100 : 0;

    return (
      <div className="h-full w-full flex flex-col items-center justify-center relative p-1 text-center">
        <div className="absolute top-0.5 right-1 text-xs opacity-70">{date.getDate()}</div>
        <div className="flex flex-col items-center justify-center flex-grow pt-2">
            <span className="text-sm font-bold leading-tight">
                {dayData.completedCardIds.length}/{dayData.cardIds.length}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">cards</span>
        </div>
        <div className="w-[80%] h-1 bg-muted rounded-full absolute bottom-1">
            <div
                className={cn("h-1 rounded-full", isCompleted ? "bg-green-500" : "bg-blue-500")}
                style={{ width: `${progress}%` }}
            />
        </div>
      </div>
    );
  };

  return (
    <Calendar
      mode="single"
      onSelect={(day) => day && handleDayClick(day)}
      defaultMonth={new Date()}
      fromDate={new Date(new Date().setDate(new Date().getDate() - 1))}
      toDate={examDate}
      modifiers={{
        today: new Date(),
        scheduled: Array.from(scheduleMap.keys()).map(d => parseISO(d)),
        completed: exam.schedule.filter(d => d.cardIds.length > 0 && d.completedCardIds.length >= d.cardIds.length).map(d => parseISO(d.date)),
        examDay: examDate,
      }}
      modifiersClassNames={{
        today: 'border-blue-500',
        scheduled: 'border border-muted-foreground/50',
        completed: 'border-green-500 bg-green-500/10',
        examDay: 'bg-primary text-primary-foreground',
      }}
      components={{
        DayContent: DayContent,
      }}
      className="p-0"
    />
  );
};
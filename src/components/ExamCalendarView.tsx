import { Calendar } from '@/components/ui/calendar';
import { ExamData } from '@/data/exams';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useDecks } from '@/contexts/DecksContext';
import { findFlashcardById } from '@/lib/deck-utils';
import { toast } from 'sonner';

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
    if (!dayData) return <div>{date.getDate()}</div>;

    const isCompleted = dayData.cardIds.length > 0 && dayData.completedCardIds.length >= dayData.cardIds.length;

    return (
      <div className="flex flex-col items-center justify-center h-full w-full relative text-center">
        <span>{date.getDate()}</span>
        <span className="text-xs font-bold">
          {dayData.completedCardIds.length}/{dayData.cardIds.length}
        </span>
        {isCompleted && (
          <div className="absolute bottom-0.5 h-1 w-4 rounded-full bg-green-500" />
        )}
      </div>
    );
  };

  return (
    <Calendar
      mode="single"
      onSelect={(day) => day && handleDayClick(day)}
      defaultMonth={examDate}
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
import { FlashcardData } from "@/data/decks";
import { ExamScheduleItem } from "@/data/exams";
import { SrsSettings } from "@/contexts/SettingsContext";
import { differenceInCalendarDays, format } from 'date-fns';

export const generateSchedule = (
  cards: FlashcardData[],
  examDate: Date,
  studyMode: 'srs' | 'cram'
): ExamScheduleItem[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDay = new Date(examDate);
  examDay.setHours(0, 0, 0, 0);

  const daysUntilExam = differenceInCalendarDays(examDay, today);

  if (daysUntilExam < 0) {
    return []; // Exam date is in the past
  }

  const schedule: ExamScheduleItem[] = [];
  const numDays = daysUntilExam + 1;

  if (cards.length === 0) return [];

  // For both modes, we'll distribute the cards evenly.
  // A more advanced SRS mode could predict future due dates, but this is a solid start.
  const cardsPerDay = Math.ceil(cards.length / numDays);
  for (let i = 0; i < numDays; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const startIndex = i * cardsPerDay;
    const endIndex = Math.min(startIndex + cardsPerDay, cards.length);
    const dailyCardIds = cards.slice(startIndex, endIndex).map(c => c.id);
    
    schedule.push({
      date: format(date, 'yyyy-MM-dd'),
      cardIds: dailyCardIds,
      completedCardIds: [],
    });
  }

  return schedule;
};

export const filterCardsForExam = (
  allCards: FlashcardData[],
  filterMode: 'all' | 'due',
  settings: SrsSettings
): FlashcardData[] => {
  if (filterMode === 'all') {
    return allCards;
  }

  // Filter for 'due' cards
  const now = new Date();
  return allCards.filter(card => {
    if (card.srs?.isSuspended) return false;
    if (settings.scheduler === 'sm2') {
      return !!card.srs?.sm2 && new Date(card.srs.sm2.due) <= now;
    }
    const srsData = settings.scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
    return !!srsData && new Date(srsData.due) <= now;
  });
};
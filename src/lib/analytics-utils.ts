import { ReviewLog } from "@/data/decks";
import { McqReviewLog } from "./idb";
import { Rating, State } from "ts-fsrs";
import { DeckData, FlashcardData } from "@/data/decks";
import { McqData } from "@/data/questionBanks";
import { SrsSettings } from "@/contexts/SettingsContext";
import { format, subDays, startOfDay, isSameDay, differenceInDays, addDays } from 'date-fns';

export const calculateAccuracy = (
  itemIds: Set<string>,
  logs: (ReviewLog | McqReviewLog)[]
): number | null => {
  const relevantLogs = logs.filter(log => {
    const id = 'cardId' in log ? log.cardId : (log as McqReviewLog).mcqId;
    return itemIds.has(id);
  });

  if (relevantLogs.length === 0) {
    return null; // No reviews, no accuracy score
  }

  const correctReviews = relevantLogs.filter(log => log.rating > Rating.Again).length;
  const accuracy = (correctReviews / relevantLogs.length) * 100;
  
  return accuracy;
};

export const calculateDueStats = (items: (FlashcardData | McqData)[], settings: SrsSettings) => {
  const now = new Date();
  const today = startOfDay(now);
  let dueToday = 0;
  let overdue = 0;

  items.forEach(item => {
    if (item.srs?.isSuspended) return;
    
    const scheduler = 'question' in item ? settings.scheduler : (settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler);
    let srsData;
    if (scheduler === 'sm2') {
        srsData = item.srs?.sm2;
    } else if (scheduler === 'fsrs6') {
        srsData = item.srs?.fsrs6;
    } else {
        srsData = item.srs?.fsrs;
    }

    if (srsData && ('state' in srsData && srsData.state !== State.New)) {
      const dueDate = startOfDay(new Date(srsData.due));
      if (dueDate <= today) {
        if (isSameDay(dueDate, today)) {
          dueToday++;
        } else {
          overdue++;
        }
      }
    }
  });

  return { dueToday, overdue };
};

export const calculateIntervalGrowth = (logs: (ReviewLog | McqReviewLog)[]) => {
  const growthFactors: number[] = [];
  logs.forEach(log => {
    if (log.state === State.Review && log.last_elapsed_days > 0) {
      const growth = log.scheduled_days / log.last_elapsed_days;
      growthFactors.push(growth);
    }
  });

  if (growthFactors.length === 0) return 0;
  const avgGrowth = growthFactors.reduce((a, b) => a + b, 0) / growthFactors.length;
  return avgGrowth;
};

export const calculateRetentionDistribution = (items: (FlashcardData | McqData)[], settings: SrsSettings) => {
    const scheduler = settings.scheduler;
    if (scheduler === 'sm2') return null;

    const w = scheduler === 'fsrs6' ? settings.fsrs6Parameters.w : settings.fsrsParameters.w;
    const factor = Math.pow(0.9, -1 / w[20]) - 1;
    const retrievability = (t: number, s: number): number => Math.pow(1 + factor * t / s, -w[20]);

    const bins: Record<string, number> = {
        '97-100%': 0, '95-97%': 0, '90-95%': 0, '85-90%': 0, '80-85%': 0, '<80%': 0,
    };

    const now = new Date();
    let reviewedCount = 0;

    items.forEach(item => {
        const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
        if (srsData && srsData.state === State.Review && srsData.last_review) {
            reviewedCount++;
            const elapsed_days = differenceInDays(now, new Date(srsData.last_review));
            const r = retrievability(elapsed_days, srsData.stability) * 100;

            if (r >= 97) bins['97-100%']++;
            else if (r >= 95) bins['95-97%']++;
            else if (r >= 90) bins['90-95%']++;
            else if (r >= 85) bins['85-90%']++;
            else if (r >= 80) bins['80-85%']++;
            else bins['<80%']++;
        }
    });

    if (reviewedCount === 0) return null;

    const chartData = Object.entries(bins).map(([name, count]) => ({ name, count }));
    return chartData;
};

export const calculateForecast = (items: (FlashcardData | McqData)[], settings: SrsSettings) => {
  const today = startOfDay(new Date());
  const forecastDays = 30;
  const forecast = Array.from({ length: forecastDays }, () => 0);

  items.forEach(item => {
    if (item.srs?.isSuspended) return;
    
    const scheduler = 'question' in item ? settings.scheduler : (settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler);
    let srsData;
    if (scheduler === 'sm2') {
        srsData = item.srs?.sm2;
    } else if (scheduler === 'fsrs6') {
        srsData = item.srs?.fsrs6;
    } else {
        srsData = item.srs?.fsrs;
    }

    if (srsData && ('state' in srsData && srsData.state !== State.New)) {
      const dueDate = startOfDay(new Date(srsData.due));
      const diff = differenceInDays(dueDate, today);
      if (diff >= 0 && diff < forecastDays) {
        forecast[diff]++;
      }
    }
  });

  return forecast.map((count, i) => ({
    date: format(addDays(today, i), 'MMM d'),
    reviews: count,
  }));
};
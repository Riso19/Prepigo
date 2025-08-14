import { ReviewLog } from "@/data/decks";
import { McqReviewLog } from "@/lib/idb";
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
  let weightedOverdueLoad = 0;

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

    if (srsData && srsData.due) {
      const dueDate = startOfDay(new Date(srsData.due));
      if (dueDate <= today) {
        if (isSameDay(dueDate, today)) {
          dueToday++;
        } else {
          overdue++;
          if (scheduler !== 'sm2' && 'difficulty' in srsData) {
            weightedOverdueLoad += srsData.difficulty;
          } else if (scheduler === 'sm2' && 'easinessFactor' in srsData) {
            // Convert SM-2 easiness (lower is harder) to FSRS difficulty (higher is harder)
            // Easiness ranges from 1.3 up. FSRS difficulty is 1-10.
            // Map 2.5 (default) to ~1, and 1.3 (hardest) to ~10.
            const sm2Difficulty = 1 + 9 * Math.max(0, (2.5 - srsData.easinessFactor) / (2.5 - 1.3));
            weightedOverdueLoad += sm2Difficulty;
          }
        }
      }
    }
  });

  return { dueToday, overdue, weightedOverdueLoad };
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

export const calculateAverageRetention = (items: (FlashcardData | McqData)[], settings: SrsSettings) => {
    const scheduler = settings.scheduler;
    if (scheduler === 'sm2') return null;

    const w = scheduler === 'fsrs6' ? settings.fsrs6Parameters.w : settings.fsrsParameters.w;
    const factor = Math.pow(0.9, -1 / w[20]) - 1;
    const retrievability = (t: number, s: number): number => Math.pow(1 + factor * t / s, -w[20]);

    const now = new Date();
    let totalRetention = 0;
    let reviewedCount = 0;

    items.forEach(item => {
        const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
        if (srsData && srsData.state === State.Review && srsData.last_review) {
            reviewedCount++;
            const elapsed_days = differenceInDays(now, new Date(srsData.last_review));
            totalRetention += retrievability(elapsed_days, srsData.stability);
        }
    });

    if (reviewedCount === 0) return 0;
    return (totalRetention / reviewedCount) * 100;
};

export const calculateAtRiskItems = (items: (FlashcardData | McqData)[], settings: SrsSettings, riskThreshold = 0.4) => {
    const scheduler = settings.scheduler;
    if (scheduler === 'sm2') return null;

    const w = scheduler === 'fsrs6' ? settings.fsrs6Parameters.w : settings.fsrsParameters.w;
    const factor = Math.pow(0.9, -1 / w[20]) - 1;
    const retrievability = (t: number, s: number): number => Math.pow(1 + factor * t / s, -w[20]);

    const now = new Date();
    let atRiskCount = 0;

    items.forEach(item => {
        const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
        if (srsData && srsData.state === State.Review && srsData.last_review) {
            const elapsed_days = differenceInDays(now, new Date(srsData.last_review));
            const r = retrievability(elapsed_days, srsData.stability);
            if ((1 - r) > riskThreshold) {
                atRiskCount++;
            }
        }
    });
    return atRiskCount;
};

export const calculateCumulativeStabilityGrowth = (logs: (ReviewLog | McqReviewLog)[]) => {
    let totalGrowth = 0;
    const logsByItem = new Map<string, (ReviewLog | McqReviewLog)[]>();

    logs.forEach(log => {
        const id = 'cardId' in log ? log.cardId : (log as McqReviewLog).mcqId;
        if (!logsByItem.has(id)) {
            logsByItem.set(id, []);
        }
        logsByItem.get(id)!.push(log);
    });

    logsByItem.forEach(itemLogs => {
        itemLogs.sort((a, b) => new Date(a.review).getTime() - new Date(b.review).getTime());
        let lastStability = 0;
        itemLogs.forEach(log => {
            if (log.rating > Rating.Again) {
                const growth = log.stability - lastStability;
                if (growth > 0) {
                    totalGrowth += growth;
                }
            }
            lastStability = log.stability;
        });
    });

    return totalGrowth;
};

export const calculateSuspectedGuesses = (logs: (ReviewLog | McqReviewLog)[]) => {
    const correctLogs = logs.filter(log => log.rating > Rating.Again && log.duration);
    if (correctLogs.length < 10) return 0;

    const durations = correctLogs.map(log => log.duration!);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = Math.sqrt(durations.map(x => Math.pow(x - avgDuration, 2)).reduce((a, b) => a + b) / durations.length);
    
    const fastThreshold = avgDuration - stdDev;

    let suspectedGuesses = 0;
    correctLogs.forEach(log => {
        if (log.duration! < fastThreshold && log.rating === Rating.Hard) {
            suspectedGuesses++;
        }
    });

    return suspectedGuesses;
};

export const calculateLearningCurve = (logs: (ReviewLog | McqReviewLog)[]) => {
    const reviewsByItem = new Map<string, (ReviewLog | McqReviewLog)[]>();
    logs.forEach(log => {
        const id = 'cardId' in log ? log.cardId : (log as McqReviewLog).mcqId;
        if (!reviewsByItem.has(id)) {
            reviewsByItem.set(id, []);
        }
        reviewsByItem.get(id)!.push(log);
    });

    const maxReviews = 10;
    const accuracyByReviewNum = Array.from({ length: maxReviews }, () => ({ correct: 0, total: 0 }));

    reviewsByItem.forEach(itemLogs => {
        // Sort logs chronologically
        itemLogs.sort((a, b) => new Date(a.review).getTime() - new Date(b.review).getTime());

        let reviewCountSinceLapse = 0;
        for (const log of itemLogs) {
            // A lapse is when a card in the review state is forgotten.
            const isLapse = log.state === State.Review && log.rating === Rating.Again;
            
            if (isLapse) {
                reviewCountSinceLapse = 0;
            }

            reviewCountSinceLapse++;

            if (reviewCountSinceLapse <= maxReviews) {
                const index = reviewCountSinceLapse - 1;
                accuracyByReviewNum[index].total++;
                if (log.rating > Rating.Again) {
                    accuracyByReviewNum[index].correct++;
                }
            }
        }
    });

    return accuracyByReviewNum
        .map((data, index) => ({
            review: index + 1,
            accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
            reviews: data.total,
        }))
        .filter(d => d.reviews > 0);
};

export const calculateForgettingCurve = (logs: (ReviewLog | McqReviewLog)[]) => {
    const reviewLogs = logs.filter(log => log.state === State.Review && log.elapsed_days > 0);
    if (reviewLogs.length < 20) return null;

    const buckets: Record<number, { correct: number, total: number }> = {};

    reviewLogs.forEach(log => {
        const interval = log.elapsed_days;
        if (!buckets[interval]) {
            buckets[interval] = { correct: 0, total: 0 };
        }
        buckets[interval].total++;
        if (log.rating > Rating.Again) {
            buckets[interval].correct++;
        }
    });

    const curveData = Object.entries(buckets)
        .map(([interval, data]) => ({
            interval: parseInt(interval, 10),
            accuracy: (data.correct / data.total) * 100,
            reviews: data.total,
        }))
        .filter(d => d.reviews > 5) // Only include intervals with a meaningful number of reviews
        .sort((a, b) => a.interval - b.interval);

    return curveData.length > 3 ? curveData : null;
};

export const calculateStabilityOverTime = (logs: (ReviewLog | McqReviewLog)[]) => {
  if (logs.length < 2) {
    return [];
  }

  const logsByDay = new Map<string, { totalStability: number; count: number }>();

  logs.forEach(log => {
    // Only consider logs where stability is meaningful
    if (log.state === State.Review || log.state === State.Relearning) {
      const day = format(startOfDay(new Date(log.review)), 'yyyy-MM-dd');
      if (!logsByDay.has(day)) {
        logsByDay.set(day, { totalStability: 0, count: 0 });
      }
      const entry = logsByDay.get(day)!;
      entry.totalStability += log.stability;
      entry.count++;
    }
  });

  const stabilityTrend = Array.from(logsByDay.entries())
    .map(([date, { totalStability, count }]) => ({
      date,
      avgStability: count > 0 ? totalStability / count : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return stabilityTrend;
};

export const calculateMemoryDecayVelocity = (stabilityTrend: { date: string; avgStability: number }[]) => {
  const today = startOfDay(new Date());
  const thirtyDaysAgo = subDays(today, 30);

  const recentData = stabilityTrend.filter(d => new Date(d.date) >= thirtyDaysAgo);

  if (recentData.length < 2) {
    return 0; // Not enough data for a trend
  }

  const velocities: number[] = [];
  for (let i = 1; i < recentData.length; i++) {
    const prev = recentData[i - 1];
    const curr = recentData[i];
    const deltaStability = curr.avgStability - prev.avgStability;
    const deltaTime = differenceInDays(new Date(curr.date), new Date(prev.date));
    if (deltaTime > 0) {
      velocities.push(deltaStability / deltaTime);
    }
  }

  if (velocities.length === 0) {
    return 0;
  }

  const avgVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
  return avgVelocity;
};

export const calculateAverageKnowledgeHalfLife = (items: (FlashcardData | McqData)[], settings: SrsSettings) => {
    const scheduler = settings.scheduler;
    if (scheduler === 'sm2') return null;

    const reviewedItems = items.filter(item => {
        const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
        return srsData && srsData.state === State.Review;
    });

    if (reviewedItems.length === 0) return 0;

    const totalHalfLife = reviewedItems.reduce((sum, item) => {
        const srsData = scheduler === 'fsrs6' ? item.srs!.fsrs6! : item.srs!.fsrs!;
        // Half-life formula for FSRS is S * ln(2)
        return sum + (srsData.stability * Math.log(2));
    }, 0);

    return totalHalfLife / reviewedItems.length;
};

export const calculateDifficultyDelta = (logs: (ReviewLog | McqReviewLog)[]) => {
    const logsByItem = new Map<string, (ReviewLog | McqReviewLog)[]>();
    logs.forEach(log => {
        const id = 'cardId' in log ? log.cardId : (log as McqReviewLog).mcqId;
        if (!logsByItem.has(id)) logsByItem.set(id, []);
        logsByItem.get(id)!.push(log);
    });

    let totalDelta = 0;
    let count = 0;

    logsByItem.forEach(itemLogs => {
        itemLogs.sort((a, b) => new Date(a.review).getTime() - new Date(b.review).getTime());
        for (let i = 0; i < itemLogs.length - 1; i++) {
            const currentLog = itemLogs[i];
            const nextLog = itemLogs[i+1];
            // The 'difficulty' in nextLog is the result of the review in currentLog
            const delta = nextLog.difficulty - currentLog.difficulty;
            totalDelta += delta;
            count++;
        }
    });

    return count > 0 ? totalDelta / count : 0;
};

export const calculateOverlearningRatio = (logs: (ReviewLog | McqReviewLog)[], settings: SrsSettings) => {
    const scheduler = settings.scheduler;
    if (scheduler === 'sm2' || logs.length === 0) return null;

    const w = scheduler === 'fsrs6' ? settings.fsrs6Parameters.w : settings.fsrsParameters.w;
    const factor = Math.pow(0.9, -1 / w[20]) - 1;
    const retrievability = (t: number, s: number): number => Math.pow(1 + factor * t / s, -w[20]);

    let overlearningReviews = 0;
    logs.forEach(log => {
        if (log.state === State.Review) {
            const r = retrievability(log.elapsed_days, log.stability);
            if (r > 0.95) {
                overlearningReviews++;
            }
        }
    });

    return (overlearningReviews / logs.length) * 100;
};

export const calculateReviewTimeDistribution = (logs: (ReviewLog | McqReviewLog)[]) => {
  const durations = logs.filter(log => log.duration && log.duration > 0).map(log => log.duration! / 1000); // in seconds
  if (durations.length < 10) return null;

  const maxTime = Math.ceil(Math.max(...durations));
  const bucketCount = 10;
  const bucketSize = Math.max(1, Math.ceil(maxTime / bucketCount));
  
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    name: `${i * bucketSize}-${(i + 1) * bucketSize - 1}s`,
    count: 0,
  }));

  durations.forEach(duration => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor(duration / bucketSize));
    buckets[bucketIndex].count++;
  });

  return buckets;
};

export const calculateDailySummary = (logs: (ReviewLog | McqReviewLog)[]) => {
  if (logs.length === 0) return [];
  const summaryByDay = new Map<string, { reviews: number; correct: number; totalDifficulty: number; difficultyCount: number }>();

  logs.forEach(log => {
    const day = format(startOfDay(new Date(log.review)), 'yyyy-MM-dd');
    if (!summaryByDay.has(day)) {
      summaryByDay.set(day, { reviews: 0, correct: 0, totalDifficulty: 0, difficultyCount: 0 });
    }
    const entry = summaryByDay.get(day)!;
    entry.reviews++;
    if (log.rating > Rating.Again) {
      entry.correct++;
    }
    if (log.state !== State.New) {
      entry.totalDifficulty += log.difficulty;
      entry.difficultyCount++;
    }
  });

  return Array.from(summaryByDay.entries())
    .map(([date, data]) => ({
      date: format(new Date(date), 'MMM d'),
      reviews: data.reviews,
      accuracy: data.reviews > 0 ? (data.correct / data.reviews) * 100 : 0,
      avgDifficulty: data.difficultyCount > 0 ? (data.totalDifficulty / data.difficultyCount) * 100 : 0, // as percentage
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const calculateTopicForgettingRate = (
  items: (FlashcardData | McqData)[],
  logs: (ReviewLog | McqReviewLog)[]
) => {
  const tagStats: Record<string, { lapses: number; reviews: number }> = {};
  const itemMap = new Map(items.map(item => [item.id, item]));

  logs.forEach(log => {
    const id = 'cardId' in log ? log.cardId : (log as McqReviewLog).mcqId;
    const item = itemMap.get(id);
    if (item?.tags) {
      item.tags.forEach(tag => {
        if (!tagStats[tag]) tagStats[tag] = { lapses: 0, reviews: 0 };
        tagStats[tag].reviews++;
        if (log.rating === Rating.Again) {
          tagStats[tag].lapses++;
        }
      });
    }
  });

  return Object.entries(tagStats)
    .map(([tag, stats]) => ({
      name: tag,
      forgetRate: stats.reviews > 0 ? (stats.lapses / stats.reviews) * 100 : 0,
      reviews: stats.reviews,
    }))
    .filter(t => t.reviews >= 5) // Only show tags with enough data
    .sort((a, b) => b.forgetRate - a.forgetRate);
};

export const calculateDifficultyWeightedMastery = (
  items: (FlashcardData | McqData)[],
  settings: SrsSettings
) => {
  const scheduler = settings.scheduler;
  if (scheduler === 'sm2') return null;

  const w = scheduler === 'fsrs6' ? settings.fsrs6Parameters.w : settings.fsrsParameters.w;
  const factor = Math.pow(0.9, -1 / w[20]) - 1;
  const retrievability = (t: number, s: number): number => Math.pow(1 + factor * t / s, -w[20]);
  const now = new Date();

  let totalMasteryScore = 0;
  let fsrsItemCount = 0;

  items.forEach(item => {
    const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
    if (srsData && srsData.state !== State.New && srsData.last_review) {
      fsrsItemCount++;
      const elapsed_days = differenceInDays(now, new Date(srsData.last_review));
      const r = retrievability(elapsed_days, srsData.stability);
      const d = srsData.difficulty;
      // Normalize difficulty from 1-10 to a penalty from 0-1
      const difficultyPenalty = (d - 1) / 9;
      totalMasteryScore += r * (1 - difficultyPenalty);
    }
  });

  if (fsrsItemCount === 0) return 0;
  return (totalMasteryScore / fsrsItemCount) * 100;
};
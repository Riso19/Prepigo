import { SrsSettings } from "@/contexts/SettingsContext";

export interface SrsData {
  repetitions: number;
  easeFactor: number;
  interval: number; // in days
  lapses: number;
  isSuspended: boolean;
  lastInterval?: number;
}

/**
 * Parses learning step strings like "1m 10m 1d" into an array of intervals in days.
 * @param stepsStr The string of learning steps.
 * @returns An array of numbers, where each number is an interval in days.
 */
function parseStepsToDays(stepsStr: string): number[] {
  if (!stepsStr || typeof stepsStr !== 'string') return [];
  return stepsStr.split(' ').map(step => {
    const value = parseFloat(step);
    if (isNaN(value)) return 0;

    const unit = step.slice(-1).toLowerCase();
    if (unit === 'm') return value / 1440; // Convert minutes to days
    if (unit === 'd') return value;
    
    return value; // Assume days if no unit
  }).filter(d => d > 0);
}

/**
 * An implementation of a SM-2 based spaced repetition algorithm.
 * @param srsData The current SRS data for the flashcard.
 * @param quality The user's rating of their recall quality (0-5).
 * @param settings The user's current SRS settings.
 * @returns The updated SrsData for the flashcard.
 */
export function sm2(srsData: SrsData, quality: number, settings: SrsSettings): SrsData {
  let { repetitions, easeFactor, interval, lapses, isSuspended, lastInterval } = srsData;

  const isReview = interval >= settings.graduatingInterval;

  if (quality < 3) { // --- Incorrect Response (Again) ---
    repetitions = 0;
    easeFactor = Math.max(settings.minEaseFactor, easeFactor - 0.20);
    
    if (isReview) {
      lapses += 1;
      lastInterval = interval; // Store the interval before it lapsed.
    }

    if (lapses >= settings.leechThreshold && settings.leechAction === 'suspend') {
      isSuspended = true;
    }

    const relearningSteps = parseStepsToDays(settings.relearningSteps);
    interval = relearningSteps.length > 0 ? relearningSteps[0] : settings.minimumInterval;

  } else { // --- Correct Response (Hard, Good, Easy) ---
    if (isReview) {
      interval = interval * easeFactor;
      if (quality === 3) interval *= settings.hardInterval;
      if (quality === 5) interval *= settings.easyBonus;
      easeFactor = Math.max(settings.minEaseFactor, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
      lastInterval = undefined; // Successful review, so clear lastInterval.
    
    } else { // Card is in learning/relearning
      const steps = lapses > 0 ? parseStepsToDays(settings.relearningSteps) : parseStepsToDays(settings.learningSteps);
      
      if (repetitions < steps.length) {
        interval = steps[repetitions];
      } else {
        // Card is graduating from learning or relearning
        if (lapses > 0 && lastInterval) {
          // Graduating from a lapse: apply newInterval penalty
          interval = Math.max(settings.minimumInterval, lastInterval * settings.newInterval);
          lastInterval = undefined; // Clear lastInterval after using it.
        } else {
          // Graduating from new
          interval = settings.graduatingInterval;
        }
      }
    }
    repetitions += 1;
  }

  if (quality === 5 && !isReview) {
    interval = settings.easyInterval;
  }

  if (isReview) {
    interval *= settings.intervalModifier;
  }
  if (interval > settings.maximumInterval) {
    interval = settings.maximumInterval;
  }

  return { repetitions, easeFactor, interval, lapses, isSuspended, lastInterval };
}
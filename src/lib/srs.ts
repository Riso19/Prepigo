import { SrsSettings } from "@/contexts/SettingsContext";

export interface SrsData {
  repetitions: number;
  easeFactor: number;
  interval: number; // in days
  lapses: number;
  isSuspended: boolean;
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
  let { repetitions, easeFactor, interval, lapses, isSuspended } = srsData;

  // Determine the card's state before this review
  const isNew = interval === 0;
  const isReview = interval >= settings.graduatingInterval;
  const isLearning = !isNew && !isReview;

  if (quality < 3) { // --- Incorrect Response (Again) ---
    repetitions = 0;
    easeFactor = Math.max(settings.minEaseFactor, easeFactor - 0.20);
    
    if (isReview) {
      lapses += 1;
    }

    // Handle leech cards
    if (lapses >= settings.leechThreshold) {
      if (settings.leechAction === 'suspend') {
        isSuspended = true;
      }
    }

    const relearningSteps = parseStepsToDays(settings.relearningSteps);
    interval = relearningSteps.length > 0 ? relearningSteps[0] : settings.minimumInterval;

  } else { // --- Correct Response (Hard, Good, Easy) ---
    if (isReview) {
      // This is a standard review for a graduated card
      interval = interval * easeFactor;
      if (quality === 3) { // Hard
        interval *= settings.hardInterval;
      }
      if (quality === 5) { // Easy
        interval *= settings.easyBonus;
      }
      easeFactor = Math.max(settings.minEaseFactor, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    
    } else { // Card is in learning/relearning
      const steps = lapses > 0 ? parseStepsToDays(settings.relearningSteps) : parseStepsToDays(settings.learningSteps);
      
      if (repetitions < steps.length) {
        interval = steps[repetitions];
      } else {
        // Card is graduating
        interval = lapses > 0 ? settings.minimumInterval : settings.graduatingInterval;
      }
    }
    repetitions += 1;
  }

  // If a new or learning card is rated "Easy", it graduates immediately
  if ((isNew || isLearning) && quality === 5) {
    interval = settings.easyInterval;
  }

  // Apply global interval modifier and caps
  if (isReview) {
    interval *= settings.intervalModifier;
  }
  if (interval > settings.maximumInterval) {
    interval = settings.maximumInterval;
  }

  return { repetitions, easeFactor, interval, lapses, isSuspended };
}
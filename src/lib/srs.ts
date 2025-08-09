import { SrsSettings } from "@/contexts/SettingsContext";

export interface SrsData {
  repetitions: number;
  easeFactor: number;
  interval: number;
}

export function sm2(srsData: SrsData, quality: number, settings: SrsSettings): SrsData {
  let { repetitions, easeFactor, interval } = srsData;
  const learningSteps = settings.learningSteps.split(',').map(s => parseInt(s.trim(), 10));

  if (quality >= 3) { // Correct response
    if (repetitions < learningSteps.length) {
      interval = learningSteps[repetitions];
    } else if (repetitions === learningSteps.length) {
      // First interval after learning steps are complete
      interval = Math.round(interval * easeFactor);
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else { // Incorrect response
    repetitions = 0;
    interval = learningSteps[0] || 1; // Reset to the first learning step
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Ease factor cannot be less than the minimum
  if (easeFactor < settings.minEaseFactor) {
    easeFactor = settings.minEaseFactor;
  }

  return { repetitions, easeFactor, interval };
}
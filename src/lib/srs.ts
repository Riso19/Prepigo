export interface SrsData {
  repetitions: number;
  easeFactor: number;
  interval: number;
}

/**
 * SM-2 algorithm implementation.
 * @param srsData - The current SRS data for the card.
 * @param quality - The quality of the response (0-5).
 * @returns The new SRS data for the card.
 */
export function sm2(srsData: SrsData, quality: number): SrsData {
  let { repetitions, easeFactor, interval } = srsData;

  if (quality >= 3) { // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else { // Incorrect response
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Ease factor cannot be less than 1.3
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  return { repetitions, easeFactor, interval };
}
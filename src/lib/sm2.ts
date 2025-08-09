import { Sm2State } from "@/data/decks";

// The quality of the response, from 0 to 5, where 5 is the best response.
export type Sm2Quality = 0 | 1 | 2 | 3 | 4 | 5;

const MIN_EASINESS_FACTOR = 1.3;
const INITIAL_EASINESS_FACTOR = 2.5;

/**
 * Calculates the next review state for a card using the SM-2 algorithm.
 *
 * @param quality The user's rating of how well they remembered the card (0-5).
 * @param cardState The current state of the card. If undefined, it's treated as a new card.
 * @returns The updated Sm2State for the card.
 */
export const sm2 = (quality: Sm2Quality, cardState?: Partial<Sm2State>): Sm2State => {
  const repetitions = cardState?.repetitions ?? 0;
  const easinessFactor = cardState?.easinessFactor ?? INITIAL_EASINESS_FACTOR;
  const interval = cardState?.interval ?? 0;

  if (quality < 3) {
    // Incorrect response: reset progress
    const nextRepetitions = 0;
    const nextInterval = 1; // Show again tomorrow
    
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + nextInterval);

    return {
      repetitions: nextRepetitions,
      easinessFactor: easinessFactor, // Easiness factor is not changed on failure
      interval: nextInterval,
      due: nextDueDate.toISOString(),
      last_review: new Date().toISOString(),
    };
  }

  // Correct response: calculate next interval
  let nextInterval: number;
  if (repetitions === 0) {
    nextInterval = 1;
  } else if (repetitions === 1) {
    nextInterval = 6;
  } else {
    nextInterval = Math.ceil(interval * easinessFactor);
  }

  const nextRepetitions = repetitions + 1;

  const newEasinessFactor = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const nextEasinessFactor = Math.max(MIN_EASINESS_FACTOR, newEasinessFactor);

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + nextInterval);

  return {
    repetitions: nextRepetitions,
    easinessFactor: nextEasinessFactor,
    interval: nextInterval,
    due: nextDueDate.toISOString(),
    last_review: new Date().toISOString(),
  };
};
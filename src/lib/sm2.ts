import { Sm2State } from "@/data/decks";

export type Sm2Quality = 0 | 1 | 2 | 3 | 4 | 5;

interface Sm2Parameters {
  startingEase: number;
  minEasinessFactor: number;
  easyBonus: number;
  intervalModifier: number;
  hardIntervalMultiplier: number;
  maximumInterval: number;
}

/**
 * Calculates the next review state for a card using an Anki-style SM-2 algorithm.
 * This function is intended for cards in the 'review' state.
 *
 * @param quality The user's rating of how well they remembered the card (3-5 for this function).
 * @param params The customizable parameters for the SM-2 algorithm.
 * @param cardState The current state of the card.
 * @returns The updated Sm2State for the card.
 */
export const sm2 = (quality: Sm2Quality, params: Sm2Parameters, cardState: Sm2State): Sm2State => {
  const { repetitions, easinessFactor, interval } = cardState;

  if (quality < 3) {
    // Lapses (quality 0-2) are handled in the StudyPage logic,
    // as they trigger a state change to 'relearning'.
    // This function should only process successful reviews.
    return cardState;
  }

  const nextRepetitions = repetitions + 1;
  let nextEasinessFactor = easinessFactor;
  let nextInterval;

  if (quality === 3) { // Hard
    nextInterval = interval * params.hardIntervalMultiplier;
    nextEasinessFactor = Math.max(params.minEasinessFactor, easinessFactor - 0.15);
  } else if (quality === 4) { // Good
    nextInterval = interval * easinessFactor;
    // easiness factor is unchanged
  } else { // Easy (quality === 5)
    nextInterval = interval * easinessFactor * params.easyBonus;
    nextEasinessFactor = easinessFactor + 0.15;
  }

  // Apply the global interval modifier
  nextInterval *= params.intervalModifier;

  // Ensure interval is at least 1 day (do not force growth relative to last)
  nextInterval = Math.max(1, nextInterval);

  // Cap at the maximum interval
  nextInterval = Math.min(params.maximumInterval, Math.ceil(nextInterval));

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + nextInterval);

  return {
    ...cardState,
    repetitions: nextRepetitions,
    easinessFactor: nextEasinessFactor,
    interval: nextInterval,
    due: nextDueDate.toISOString(),
    last_review: new Date().toISOString(),
  };
};
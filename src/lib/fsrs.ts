export type ReviewRating = 1 | 2 | 3 | 4; // 1:Again, 2:Hard, 3:Good, 4:Easy

export interface FSRSParameters {
  request_retention: number;
  maximum_interval: number;
  w: number[];
}

export interface FSRSData {
  stability: number;
  difficulty: number;
}

export const defaultFSRSParameters: FSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [
    // Default parameters for FSRS-4.5, with FSRS-6 additions for same-day reviews.
    // A full FSRS-6 implementation would require updating all 21 parameters.
    // w_0 to w_3: initial stability for ratings 1-4
    0.4, 0.6, 2.4, 5.8, 
    // w_4: initial difficulty
    4.93, 
    // w_5: difficulty change factor
    0.94, 
    // w_6: difficulty change factor
    0.86, 
    // w_7: (unused in this formula)
    0.01, 
    // w_8 to w_10: stability update factors for "Good"
    1.49, 0.14, 0.94, 
    // w_11 to w_13: stability update factors for "Hard"
    2.18, 0.05, 0.34, 
    // w_14: "Easy" bonus
    1.26, 
    // w_15, w_16: stability update factors for "Again"
    0.29, 2.61,
    // FSRS-6 same-day review parameters
    // w_17
    2.5,
    // w_18
    -0.5,
    // w_19
    0.2,
    // w_20 (unused in current formulas but included for completeness)
    0.1,
  ],
};

const constrain = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const ivl_fn = (s: number, r: number): number => {
  return Math.max(1, Math.round(s * (1 / r - 1)));
};

/**
 * The core FSRS scheduling function.
 * @param cardData The current stability and difficulty of the card.
 * @param rating The user's review rating (1-4).
 * @param elapsedDays The number of days since the last review.
 * @param params The FSRS parameters to use.
 * @returns The new stability, difficulty, and next interval in days.
 */
export const fsrs = (
  cardData: Partial<FSRSData>,
  rating: ReviewRating,
  elapsedDays: number,
  params: FSRSParameters = defaultFSRSParameters
): { stability: number; difficulty: number; interval: number } => {
  const { w, request_retention, maximum_interval } = params;
  const isNewCard = !cardData.stability || !cardData.difficulty;

  let s = cardData.stability || 0;
  let d = cardData.difficulty || 0;

  if (isNewCard) {
    // Initialize stability and difficulty for a new card
    s = w[rating - 1];
    d = constrain(w[4] - (rating - 3) * w[5], 1, 10);
  } else {
    if (elapsedDays < 1) {
      // FSRS-6 same-day review logic
      // Difficulty (d) does not change in same-day reviews.
      const G = rating;
      s = s * Math.exp(w[17] * (G - 3 + w[18])) * Math.pow(s, -w[19]);
    } else {
      // FSRS-4.5 logic for reviews after one or more days
      const r = Math.pow(1 + elapsedDays / (9 * s), -1); // Retrievability
      d = constrain(d - w[6] * (rating - 3), 1, 10);

      switch (rating) {
        case 1: // Again
          s = w[15] * Math.pow(d, -w[16]);
          break;
        case 2: // Hard
          s = s * (1 + Math.exp(w[11]) * (11 - d) * Math.pow(s, -w[12]) * (Math.exp((1 - r) * w[13]) - 1));
          break;
        case 3: // Good
          s = s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1));
          break;
        case 4: // Easy
          s = s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1)) * w[14];
          break;
      }
    }
  }

  s = constrain(s, 0.1, maximum_interval);
  const interval = constrain(ivl_fn(s, request_retention), 1, maximum_interval);

  return { stability: s, difficulty: d, interval };
};
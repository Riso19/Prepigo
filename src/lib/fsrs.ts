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
    // These are the default parameters for FSRS-4.5
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18,
    0.05, 0.34, 1.26, 0.29, 2.61,
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
    // Update stability and difficulty for a reviewed card
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
        // The "Good" formula is used, with an added "Easy Bonus" multiplier
        s = s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1)) * w[14];
        break;
    }
  }

  s = constrain(s, 0.1, maximum_interval);
  const interval = constrain(ivl_fn(s, request_retention), 1, maximum_interval);

  return { stability: s, difficulty: d, interval };
};
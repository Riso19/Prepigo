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
  w: [ // FSRS-6 parameters
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 
    1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2, 0.88, 0.01, 
    2.05, 0.2, 0.9, 0.5, 1.0
  ],
};

const constrain = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const ivl_fn = (s: number, r: number): number => {
  return Math.max(1, Math.round(s * (1 / r - 1)));
};

/**
 * The core FSRS-6 scheduling function.
 * @param cardData The current stability and difficulty of the card.
 * @param rating The user's review rating (1-4), referred to as G.
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
  const G = rating;

  let s = cardData.stability || 0;
  let d = cardData.difficulty || 0;

  if (isNewCard) {
    // Initial stability (from FSRS-4.5)
    s = w[G - 1];
    // Initial difficulty (FSRS-5 formula)
    d = w[4] - Math.exp(w[5]) * (G - 1) + 1;
  } else {
    if (elapsedDays < 1) {
      // FSRS-6 same-day review logic
      s = s * Math.exp(w[17] * (G - 3 + w[18])) * Math.pow(s, -w[19]);
      // Difficulty does not change on same-day reviews
    } else {
      // Subsequent-day review
      // FSRS-6 Retrievability
      const factor = Math.pow(0.9, -1 / w[20]) - 1;
      const r = Math.pow(1 + factor * elapsedDays / s, -w[20]);

      // Stability update (from FSRS-4.5)
      switch (G) {
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

      // Difficulty update (FSRS-5 formula with Linear Damping and Mean Reversion)
      const deltaD = -w[6] * (G - 3);
      const d_prime = d + deltaD * ((10 - d) / 9);
      const d0_4 = w[4] - Math.exp(w[5]) * (4 - 1) + 1; // D₀(4)
      const d_double_prime = w[7] * d0_4 + (1 - w[7]) * d_prime;
      d = d_double_prime;
    }
  }

  s = constrain(s, 0.1, maximum_interval);
  d = constrain(d, 1, 10);
  const interval = constrain(ivl_fn(s, request_retention), 1, maximum_interval);

  return { stability: s, difficulty: d, interval };
};
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
  w: [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621],
};

const constrain = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const ivl_fn = (s: number, r: number): number => {
  return Math.max(1, Math.round(s * (1 / r - 1)));
};

/**
 * The core FSRS-5 scheduling function.
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
      // Same-day review stability update (FSRS-5 formula)
      s = s * Math.exp(w[17] * (G - 3 + w[18]));
      // Difficulty does not change on same-day reviews
    } else {
      // Subsequent-day review
      // Retrievability (from FSRS-4.5)
      const r = Math.pow(1 + elapsedDays / (9 * s), -1);

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
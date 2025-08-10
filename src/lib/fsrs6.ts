import { State, Rating, Card, ReviewLog, RecordLog } from "ts-fsrs";

export { State, Rating };
export type { Card, ReviewLog, RecordLog };

export interface FSRS6Parameters {
  request_retention: number;
  maximum_interval: number;
  w: number[]; // 21 parameters
}

// Default parameters for FSRS-6.
// WARNING: This list is incomplete as the provided context was cut off.
// The last 8 parameters (w[13] to w[20]) are placeholders based on FSRS-4.5 defaults.
// The user should provide the complete list for accurate scheduling.
const defaultWeights: number[] = [
    0.2120, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.0010, 
    1.8722, 0.1666, 0.7960, 1.4835, 0.0614, 
    // Placeholders for missing weights, using FSRS-4.5 defaults as a base
    1.4,    // w[13] (S'f related)
    0.5,    // w[14] (S'f related)
    0.2,    // w[15] (S'r related) - Not used in FSRS-4.5 S'r
    0.9,    // w[16] (S'r related) - Not used in FSRS-4.5 S'r
    0.2,    // w[17] (same-day S' related)
    0.5,    // w[18] (same-day S' related)
    0.2,    // w[19] (same-day S' related)
    1.5     // w[20] (retrievability related)
];

export const generatorParameters = (props?: Partial<FSRS6Parameters>): FSRS6Parameters => {
  return {
    request_retention: props?.request_retention ?? 0.9,
    maximum_interval: props?.maximum_interval ?? 36500,
    w: props?.w ?? defaultWeights,
  };
};

const date_diff = (a: Date, b: Date): number => {
    return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export const fsrs6 = (params: FSRS6Parameters) => {
  const w = params.w;

  const init_d = (g: Rating): number => {
    return w[4] - Math.exp(w[5]) * (g - 1) + 1;
  };

  const next_d = (d: number, g: Rating): number => {
    const delta_d = -w[6] * (g - 3);
    const d_next_temp = d + delta_d * (10 - d) / 9;
    const d_initial_easy = init_d(Rating.Easy);
    return w[7] * d_initial_easy + (1 - w[7]) * d_next_temp;
  };

  const next_s_recall = (d: number, s: number, r: number): number => {
    return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1));
  };

  const next_s_forget = (d: number, s: number, r: number): number => {
    return w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
  };

  const next_s_same_day = (s: number, g: Rating): number => {
    return s * Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(s, -w[19]);
  };

  const retrievability = (t: number, s: number): number => {
    const factor = Math.pow(0.9, -1 / w[20]) - 1;
    return Math.pow(1 + factor * t / s, -w[20]);
  };

  const next_interval = (s: number): number => {
    const factor = Math.pow(0.9, -1 / w[20]) - 1;
    const interval = (s / factor) * (Math.pow(params.request_retention, -1 / w[20]) - 1);
    return Math.min(Math.max(1, Math.round(interval)), params.maximum_interval);
  };

  return {
    repeat: (card: Card, now: Date): RecordLog => {
      const originalState = card.state;
      card = { ...card };
      if (card.state === State.New) {
        card.elapsed_days = 0;
        card.scheduled_days = 0;
        card.reps = 0;
        card.lapses = 0;
        card.state = State.Learning;
        card.due = now;
      }

      const elapsed_days = card.last_review ? date_diff(now, card.last_review) : 0;
      card.last_review = now;

      const recordLog: RecordLog = {} as RecordLog;

      for (const rating of Object.values(Rating).filter(v => typeof v === 'number') as Rating[]) {
        const next_card = { ...card };
        
        if (rating === Rating.Again) {
            next_card.reps += 1;
            next_card.lapses += 1;
            const r = retrievability(elapsed_days, card.stability);
            next_card.difficulty = next_d(card.difficulty, rating);
            next_card.stability = next_s_forget(next_card.difficulty, card.stability, r);
            next_card.state = State.Relearning;
            next_card.scheduled_days = 1;
        } else {
            if (originalState === State.New) {
                next_card.difficulty = init_d(rating);
                next_card.stability = w[rating - 1];
                next_card.reps = 1;
            } else {
                const r = retrievability(elapsed_days, card.stability);
                next_card.difficulty = next_d(card.difficulty, rating);
                next_card.stability = next_s_recall(next_card.difficulty, card.stability, r);
                if (elapsed_days === 0) {
                    next_card.stability = next_s_same_day(next_card.stability, rating);
                }
                next_card.reps += 1;
            }
            next_card.state = State.Review;
            next_card.scheduled_days = next_interval(next_card.stability);
        }

        next_card.due = new Date(now.getTime() + next_card.scheduled_days * 24 * 60 * 60 * 1000);
        
        const reviewLog: ReviewLog = {
            rating: rating,
            state: originalState,
            due: card.due,
            stability: card.stability,
            difficulty: card.difficulty,
            elapsed_days: card.elapsed_days,
            last_elapsed_days: elapsed_days,
            scheduled_days: next_card.scheduled_days,
            review: now,
            learning_steps: card.learning_steps,
        };

        recordLog[rating] = {
            card: next_card,
            log: reviewLog,
        };
      }
      return recordLog;
    }
  };
};
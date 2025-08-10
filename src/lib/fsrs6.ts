import { State, Rating, Card, ReviewLog, RecordLog } from "ts-fsrs";

export { State, Rating };
export type { Card, ReviewLog, RecordLog };

export interface FSRS6Parameters {
  request_retention: number;
  maximum_interval: number;
  w: number[]; // 21 parameters
}

export interface FSRS6Steps {
    learning: number[];
    relearning: number[];
}

// Default parameters for FSRS-6.
const defaultWeights: number[] = [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 
    1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 
    1.8729, 0.5425, 0.0912, 0.0658, 0.1542
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

export const fsrs6 = (params: FSRS6Parameters, steps: FSRS6Steps) => {
  const w = params.w;

  const init_d = (g: Rating): number => w[4] - Math.exp(w[5]) * (g - 1) + 1;
  const next_d = (d: number, g: Rating): number => {
    const delta_d = -w[6] * (g - 3);
    const d_next_temp = d + delta_d * (10 - d) / 9;
    const d_initial_easy = init_d(Rating.Easy);
    return w[7] * d_initial_easy + (1 - w[7]) * d_next_temp;
  };
  const next_s_recall = (d: number, s: number, r: number): number => s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1));
  const next_s_forget = (d: number, s: number, r: number): number => w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
  const next_s_same_day = (s: number, g: Rating): number => s * Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(s, -w[19]);
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
      card = { ...card };
      if (card.state === State.New) {
        card.elapsed_days = 0;
        card.scheduled_days = 0;
        card.reps = 0;
        card.lapses = 0;
        card.learning_steps = 0;
      }

      const elapsed_days = card.last_review ? date_diff(now, card.last_review) : 0;
      const last_elapsed_days = card.elapsed_days;
      card.last_review = now;
      card.elapsed_days = elapsed_days;

      const recordLog: RecordLog = {} as RecordLog;

      for (const rating of Object.values(Rating).filter(v => typeof v === 'number') as Rating[]) {
        const next_card = { ...card };
        let reviewLog: ReviewLog;

        if (next_card.state === State.New) {
            next_card.state = State.Learning;
            next_card.learning_steps = 0;
        }

        if (next_card.state === State.Learning || next_card.state === State.Relearning) {
            const current_steps = next_card.state === State.Learning ? steps.learning : steps.relearning;
            
            if (rating === Rating.Again) {
                next_card.learning_steps = 0;
                const delay = current_steps[0];
                next_card.scheduled_days = Math.floor(delay / 1440);
                next_card.due = new Date(now.getTime() + delay * 60 * 1000);
            } else if (rating === Rating.Hard) {
                const current_step_index = next_card.learning_steps!;
                const delay = current_steps[Math.min(current_step_index, current_steps.length - 1)];
                next_card.scheduled_days = Math.floor(delay / 1440);
                next_card.due = new Date(now.getTime() + delay * 60 * 1000);
            } else if (rating === Rating.Good) {
                const next_step_index = next_card.learning_steps! + 1;
                if (next_step_index >= current_steps.length) {
                    // Graduate
                    next_card.state = State.Review;
                    next_card.learning_steps = 0;
                    next_card.difficulty = init_d(Rating.Good);
                    next_card.stability = w[Rating.Good - 1];
                    next_card.reps = 1;
                    next_card.scheduled_days = next_interval(next_card.stability);
                    next_card.due = new Date(now.getTime() + next_card.scheduled_days * 24 * 60 * 60 * 1000);
                } else {
                    // Advance to next step
                    next_card.learning_steps = next_step_index;
                    const delay = current_steps[next_step_index];
                    next_card.scheduled_days = Math.floor(delay / 1440);
                    next_card.due = new Date(now.getTime() + delay * 60 * 1000);
                }
            } else if (rating === Rating.Easy) {
                // Graduate immediately
                next_card.state = State.Review;
                next_card.learning_steps = 0;
                next_card.difficulty = init_d(Rating.Easy);
                next_card.stability = w[Rating.Easy - 1];
                next_card.reps = 1;
                next_card.scheduled_days = next_interval(next_card.stability);
                next_card.due = new Date(now.getTime() + next_card.scheduled_days * 24 * 60 * 60 * 1000);
            }
        } else if (next_card.state === State.Review) {
            const r = retrievability(elapsed_days, card.stability);
            if (rating === Rating.Again) {
                next_card.lapses += 1;
                next_card.reps += 1;
                next_card.state = State.Relearning;
                next_card.learning_steps = 0;
                next_card.difficulty = next_d(card.difficulty, rating);
                next_card.stability = next_s_forget(next_card.difficulty, card.stability, r);
                const delay = steps.relearning[0];
                next_card.scheduled_days = Math.floor(delay / 1440);
                next_card.due = new Date(now.getTime() + delay * 60 * 1000);
            } else {
                next_card.reps += 1;
                next_card.difficulty = next_d(card.difficulty, rating);
                next_card.stability = next_s_recall(next_card.difficulty, card.stability, r);
                if (elapsed_days === 0) {
                    next_card.stability = next_s_same_day(next_card.stability, rating);
                }
                next_card.scheduled_days = next_interval(next_card.stability);
                next_card.due = new Date(now.getTime() + next_card.scheduled_days * 24 * 60 * 60 * 1000);
            }
        }

        reviewLog = {
            rating: rating,
            state: card.state,
            due: card.due,
            stability: card.stability,
            difficulty: card.difficulty,
            elapsed_days: elapsed_days,
            last_elapsed_days: last_elapsed_days,
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
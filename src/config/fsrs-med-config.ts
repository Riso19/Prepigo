import { FSRSParameters } from "ts-fsrs";

// Medical Student FSRS Settings for MCQ Review
// Tuned for broad coverage and high retention before exams.
export const fsrsMedConfig: FSRSParameters = {
  request_retention: 0.82,
  maximum_interval: 365,
  w: [
    0.3,   // Initial stability factor
    1.6,   // Stability growth factor
    2.0,   // Recall probability adjustment
    0.2,   // Forget penalty
    1.4,   // Easy rating growth
    0.35,  // Hard rating penalty
    2.5,   // Max stability boost
    0.6,   // Lapse penalty
    1.2,   // Difficulty scaling
    0.4,   // Guessed/unsure handling
    1.6,   // Confidence-weighted boost
    1.05   // Topic difficulty multiplier
  ],
  learning_steps: ['1m', '10m'], // Default learning steps: 1 minute, then 10 minutes
  relearning_steps: ['10m'],
  enable_fuzz: true,
  enable_short_term: false,
};
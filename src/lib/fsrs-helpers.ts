import { Rating, RecordLog } from 'ts-fsrs';

// Helper to safely access FSRS outcomes by Rating enum.
// The ts-fsrs types make direct enum indexing awkward; use a narrow any-cast for safe runtime behavior.
export function outcomeByRating<T extends RecordLog>(outcomes: T, rating: Rating) {
  return (outcomes as unknown as Record<number, T[keyof T]>)[rating] as T[keyof T];
}

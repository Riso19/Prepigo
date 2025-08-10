import { ReviewLog } from "@/data/decks";
import { McqReviewLog } from "./idb";
import { Rating } from "ts-fsrs";

export const calculateAccuracy = (
  itemIds: Set<string>,
  logs: (ReviewLog | McqReviewLog)[]
): number | null => {
  const relevantLogs = logs.filter(log => {
    const id = 'cardId' in log ? log.cardId : (log as McqReviewLog).mcqId;
    return itemIds.has(id);
  });

  if (relevantLogs.length === 0) {
    return null; // No reviews, no accuracy score
  }

  const correctReviews = relevantLogs.filter(log => log.rating > Rating.Again).length;
  const accuracy = (correctReviews / relevantLogs.length) * 100;
  
  return accuracy;
};
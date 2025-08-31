import { FlashcardData } from "@/data/decks";
import { McqData } from "@/data/questionBanks";
import { State } from "ts-fsrs";

export type ItemStatus = "New" | "Learning" | "Relearning" | "Young" | "Mature" | "Suspended";

// maturityThresholdDays defaults to 21 for backward compatibility
export const getItemStatus = (
    item: FlashcardData | McqData,
    scheduler: 'fsrs' | 'sm2' | 'fsrs6',
    maturityThresholdDays: number = 21,
): ItemStatus => {
    if (item.srs?.isSuspended) {
        return "Suspended";
    }

    if (scheduler === 'fsrs' || scheduler === 'fsrs6') {
        const srsState = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
        if (!srsState || srsState.state === State.New) return "New";
        if (srsState.state === State.Learning) return "Learning";
        if (srsState.state === State.Relearning) return "Relearning";
        if (srsState.state === State.Review) {
            return srsState.stability < maturityThresholdDays ? "Young" : "Mature";
        }
    } else { // sm2 (only for flashcards)
        if ('question' in item) { // Type guard for FlashcardData
            const srsState = item.srs?.sm2;
            if (!srsState || srsState.state === 'new' || !srsState.state) return "New";
            if (srsState.state === 'learning') return "Learning";
            if (srsState.state === 'relearning') return "Relearning";
            if (srsState.state === 'review') {
                return (srsState.interval || 0) < maturityThresholdDays ? "Young" : "Mature";
            }
        } else { // MCQs don't use SM2, default to New if somehow called with it
            return "New";
        }
    }
    return "New";
};
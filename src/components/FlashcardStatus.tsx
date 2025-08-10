import { FlashcardData } from "@/data/decks";
import { Badge } from "@/components/ui/badge";
import { State } from "ts-fsrs";
import { cn } from "@/lib/utils";

type CardStatus = "New" | "Learning" | "Relearning" | "Young" | "Mature" | "Suspended";

export const getCardStatus = (card: FlashcardData, scheduler: 'fsrs' | 'sm2' | 'fsrs6'): CardStatus => {
    if (card.srs?.isSuspended) {
        return "Suspended";
    }

    if (scheduler === 'fsrs' || scheduler === 'fsrs6') {
        const srsState = scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
        if (!srsState || srsState.state === State.New) return "New";
        if (srsState.state === State.Learning) return "Learning";
        if (srsState.state === State.Relearning) return "Relearning";
        if (srsState.state === State.Review) {
            return srsState.stability < 21 ? "Young" : "Mature";
        }
    } else { // sm2
        const srsState = card.srs?.sm2;
        if (!srsState || srsState.state === 'new' || !srsState.state) return "New";
        if (srsState.state === 'learning') return "Learning";
        if (srsState.state === 'relearning') return "Relearning";
        if (srsState.state === 'review') {
            return (srsState.interval || 0) < 21 ? "Young" : "Mature";
        }
    }
    return "New";
};

interface FlashcardStatusProps {
  card: FlashcardData;
  scheduler: 'fsrs' | 'sm2' | 'fsrs6';
}

export const FlashcardStatus = ({ card, scheduler }: FlashcardStatusProps) => {
  const status = getCardStatus(card, scheduler);

  const statusStyles: Record<CardStatus, string> = {
    New: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    Learning: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    Relearning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    Young: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    Mature: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    Suspended: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", statusStyles[status])}>
      {status}
    </Badge>
  );
};
import { FlashcardData } from "@/data/decks";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getItemStatus, ItemStatus } from "@/lib/srs-utils";

interface FlashcardStatusProps {
  card: FlashcardData;
  scheduler: 'fsrs' | 'sm2' | 'fsrs6';
}

export const FlashcardStatus = ({ card, scheduler }: FlashcardStatusProps) => {
  const status = getItemStatus(card, scheduler);

  const statusStyles: Record<ItemStatus, string> = {
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
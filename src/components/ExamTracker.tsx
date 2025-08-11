import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { McqData } from "@/data/questionBanks";
import { useRef, useEffect } from "react";

interface ExamTrackerProps {
  queue: McqData[];
  answers: Record<number, string | null>;
  marked: Set<number>;
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export const ExamTracker = ({ queue, answers, marked, currentIndex, onNavigate }: ExamTrackerProps) => {
  const currentButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (currentButtonRef.current) {
      currentButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex]);

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-md border bg-background">
      <div className="flex w-max space-x-2 p-2">
        {queue.map((_, index) => {
          const isAnswered = answers[index] !== undefined && answers[index] !== null;
          const isMarked = marked.has(index);
          const isCurrent = index === currentIndex;

          return (
            <Button
              key={index}
              ref={isCurrent ? currentButtonRef : null}
              variant={isCurrent ? 'default' : (isAnswered ? 'secondary' : 'outline')}
              className={cn(
                "h-9 w-9 p-0 relative",
                isMarked && "ring-2 ring-yellow-500"
              )}
              onClick={() => onNavigate(index)}
            >
              {index + 1}
            </Button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
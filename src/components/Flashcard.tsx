import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useResolvedHtml } from "@/hooks/use-resolved-html";
import { useState, useLayoutEffect, useRef } from "react";

interface FlashcardProps {
  question: string;
  answer: string;
  isFlipped: boolean;
  onClick: () => void;
}

const Flashcard = ({ question, answer, isFlipped, onClick }: FlashcardProps) => {
  const resolvedQuestion = useResolvedHtml(question);
  const resolvedAnswer = useResolvedHtml(answer);

  const [height, setHeight] = useState<number | 'auto'>('auto');
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frontHeight = frontRef.current?.scrollHeight || 0;
    const backHeight = backRef.current?.scrollHeight || 0;
    const newHeight = isFlipped ? backHeight : frontHeight;
    setHeight(Math.max(newHeight, 320)); // min-h-80 (20rem)
  }, [isFlipped, resolvedQuestion, resolvedAnswer]);

  return (
    <div
      className="w-full [perspective:1000px] cursor-pointer"
      style={{ height: height === 'auto' ? undefined : `${height}px`, transition: 'height 0.5s ease-in-out' }}
      onClick={onClick}
    >
      <div
        className={cn(
          "relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d]",
          isFlipped && "[transform:rotateY(180deg)]"
        )}
      >
        {/* Front of the card */}
        <div ref={frontRef} className="absolute w-full h-full [backface-visibility:hidden]">
          <Card className="w-full h-full flex flex-col">
            <CardContent className="p-6 text-center flex-grow flex flex-col items-center justify-center">
              <p className="text-lg font-semibold text-muted-foreground">Question:</p>
              <div className="mt-2 text-xl md:text-2xl font-bold prose dark:prose-invert max-w-none w-full" dangerouslySetInnerHTML={{ __html: resolvedQuestion }} />
            </CardContent>
          </Card>
        </div>
        {/* Back of the card */}
        <div ref={backRef} className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <Card className="w-full h-full flex flex-col bg-secondary">
            <CardContent className="p-6 text-center flex-grow flex flex-col items-center justify-center">
              <p className="text-lg font-semibold text-muted-foreground">Answer:</p>
              <div className="mt-2 text-xl md:text-2xl font-bold prose dark:prose-invert max-w-none w-full" dangerouslySetInnerHTML={{ __html: resolvedAnswer }} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
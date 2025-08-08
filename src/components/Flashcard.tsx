import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FlashcardProps {
  question: string;
  answer: string;
  isFlipped: boolean;
  onClick: () => void;
}

const Flashcard = ({ question, answer, isFlipped, onClick }: FlashcardProps) => {
  return (
    <div className="w-full h-80 [perspective:1000px] cursor-pointer" onClick={onClick}>
      <div
        className={cn(
          "relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d]",
          isFlipped && "[transform:rotateY(180deg)]"
        )}
      >
        {/* Front of the card */}
        <div className="absolute w-full h-full [backface-visibility:hidden]">
          <Card className="w-full h-full flex flex-col items-center justify-center">
            <CardContent className="p-6 text-center">
              <p className="text-lg font-semibold text-muted-foreground">Question:</p>
              <div className="mt-2 text-2xl font-bold prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: question }} />
            </CardContent>
          </Card>
        </div>
        {/* Back of the card */}
        <div className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <Card className="w-full h-full flex flex-col items-center justify-center bg-secondary">
            <CardContent className="p-6 text-center">
              <p className="text-lg font-semibold text-muted-foreground">Answer:</p>
              <div className="mt-2 text-2xl font-bold prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: answer }} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
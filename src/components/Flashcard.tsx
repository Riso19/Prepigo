import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HtmlRenderer } from "./HtmlRenderer";
import { useSettings } from "@/contexts/SettingsContext";

interface FlashcardProps {
  question: string;
  answer: string;
  isFlipped: boolean;
  onClick: () => void;
}

const Flashcard = ({ question, answer, isFlipped, onClick }: FlashcardProps) => {
  const { settings } = useSettings();

  if (settings.disableFlipAnimation) {
    return (
      <div
        className="w-full min-h-[20rem] cursor-pointer grid"
        onClick={onClick}
      >
        {!isFlipped ? (
          <Card className="w-full h-full flex flex-col">
            <CardContent className="p-6 text-center flex-grow flex flex-col items-center justify-center">
              <p className="text-base font-semibold text-muted-foreground">Question:</p>
              <HtmlRenderer
                html={question}
                className="mt-2 text-base md:text-lg font-bold prose dark:prose-invert max-w-none w-full"
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full h-full flex flex-col bg-secondary">
            <CardContent className="p-6 text-center flex-grow flex flex-col items-center justify-center">
              <p className="text-base font-semibold text-muted-foreground">Answer:</p>
              <HtmlRenderer
                html={answer}
                className="mt-2 text-base md:text-lg font-bold prose dark:prose-invert max-w-none w-full"
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-[20rem] [perspective:1000px] cursor-pointer grid"
      onClick={onClick}
    >
      <div
        className={cn(
          "transition-transform duration-700 [transform-style:preserve-3d] grid [grid-area:1/1]",
          isFlipped && "[transform:rotateY(180deg)]"
        )}
      >
        {/* Front of the card */}
        <div className="[backface-visibility:hidden] [grid-area:1/1]">
          <Card className="w-full h-full flex flex-col">
            <CardContent className="p-6 text-center flex-grow flex flex-col items-center justify-center">
              <p className="text-base font-semibold text-muted-foreground">Question:</p>
              <HtmlRenderer
                html={question}
                className="mt-2 text-base md:text-lg font-bold prose dark:prose-invert max-w-none w-full"
              />
            </CardContent>
          </Card>
        </div>
        {/* Back of the card */}
        <div className="[backface-visibility:hidden] [transform:rotateY(180deg)] [grid-area:1/1]">
          <Card className="w-full h-full flex flex-col bg-secondary">
            <CardContent className="p-6 text-center flex-grow flex flex-col items-center justify-center">
              <p className="text-base font-semibold text-muted-foreground">Answer:</p>
              <HtmlRenderer
                html={answer}
                className="mt-2 text-base md:text-lg font-bold prose dark:prose-invert max-w-none w-full"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
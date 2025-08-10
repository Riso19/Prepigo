import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useResolvedHtml } from "@/hooks/use-resolved-html";

interface ClozePlayerProps {
  text: string;
  description?: string;
  isFlipped: boolean;
  onClick: () => void;
}

const ClozePlayer = ({ text, description, isFlipped, onClick }: ClozePlayerProps) => {
  const resolvedText = useResolvedHtml(text);
  const resolvedDescription = useResolvedHtml(description);

  const renderClozeText = (isRevealed: boolean) => {
    const clozeRegex = /{{c(\d+)::(.+?)}}/g;
    let processedText = resolvedText;

    if (isRevealed) {
      processedText = processedText.replace(clozeRegex, (_match, _id, content) => {
        return `<strong class="text-primary">${content}</strong>`;
      });
    } else {
      processedText = processedText.replace(clozeRegex, (_match, _id, _content) => {
        return `<span class="text-primary font-bold">[...]</span>`;
      });
    }

    return <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: processedText }} />;
  };

  return (
    <div className="w-full min-h-[20rem] cursor-pointer" onClick={onClick}>
      <Card className="w-full h-full flex flex-col">
        <CardContent className="p-6 text-center w-full flex-grow flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold">
            {renderClozeText(isFlipped)}
          </div>
          {isFlipped && description && (
            <>
              <Separator className="my-4" />
              <div className="text-sm text-muted-foreground prose dark:prose-invert max-w-none text-left" dangerouslySetInnerHTML={{ __html: resolvedDescription }} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClozePlayer;
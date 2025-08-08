import { Card, CardContent } from "@/components/ui/card";

interface ClozePlayerProps {
  text: string;
  isFlipped: boolean;
  onClick: () => void;
}

const ClozePlayer = ({ text, isFlipped, onClick }: ClozePlayerProps) => {
  const renderClozeText = (isRevealed: boolean) => {
    const clozeRegex = /{{c(\d+)::(.+?)}}/g;
    let processedText = text;

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
    <div className="w-full h-80 [perspective:1000px] cursor-pointer" onClick={onClick}>
      <Card className="w-full h-full flex items-center justify-center">
        <CardContent className="p-6 text-center">
          <div className="text-2xl font-semibold">
            {renderClozeText(isFlipped)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClozePlayer;
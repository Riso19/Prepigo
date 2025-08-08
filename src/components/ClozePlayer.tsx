import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ClozePlayerProps {
  text: string;
  isFlipped: boolean;
  onClick: () => void;
}

const ClozePlayer = ({ text, isFlipped, onClick }: ClozePlayerProps) => {
  const renderClozeText = (isRevealed: boolean) => {
    const clozeRegex = /{{c(\d+)::(.+?)}}/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = clozeRegex.exec(text)) !== null) {
      // Text before the cloze
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // The cloze itself
      const clozeContent = match[2];
      if (isRevealed) {
        parts.push(<strong key={match.index} className="text-primary">{clozeContent}</strong>);
      } else {
        parts.push(<span key={match.index} className="text-primary font-bold">[...]</span>);
      }
      lastIndex = match.index + match[0].length;
    }

    // Text after the last cloze
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  return (
    <div className="w-full h-80 [perspective:1000px] cursor-pointer" onClick={onClick}>
      <Card className="w-full h-full flex items-center justify-center">
        <CardContent className="p-6 text-center">
          <p className="text-2xl font-semibold">
            {renderClozeText(isFlipped)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClozePlayer;
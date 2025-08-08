import { Card, CardContent } from "@/components/ui/card";
import { Occlusion } from "@/data/decks";

interface ImageOcclusionPlayerProps {
  imageUrl: string;
  occlusions: Occlusion[];
  questionOcclusionId: number;
  description?: string;
  isFlipped: boolean;
  onClick: () => void;
}

const ImageOcclusionPlayer = ({ imageUrl, occlusions, questionOcclusionId, description, isFlipped, onClick }: ImageOcclusionPlayerProps) => {
  return (
    <div className="w-full h-auto max-w-2xl cursor-pointer" onClick={onClick}>
      <Card>
        <CardContent className="p-0">
          <div className="relative p-2">
            <img src={imageUrl} alt="Study card" className="w-full h-auto" />
            <svg className="absolute top-2 left-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)]">
              {occlusions.map(occ => {
                const isQuestion = occ.id === questionOcclusionId;
                if (isFlipped && isQuestion) {
                  return null;
                }
                
                const fillColor = isQuestion ? "fill-blue-500" : "fill-primary";
                return (
                  <rect
                    key={occ.id}
                    x={occ.x}
                    y={occ.y}
                    width={occ.width}
                    height={occ.height}
                    className={fillColor}
                  />
                );
              })}
            </svg>
          </div>
          {isFlipped && description && (
            <div className="p-4 border-t">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Extra Info:</p>
              <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: description }} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageOcclusionPlayer;
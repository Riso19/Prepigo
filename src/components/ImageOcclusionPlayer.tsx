import { Card, CardContent } from "@/components/ui/card";
import { Occlusion } from "@/data/decks";

interface ImageOcclusionPlayerProps {
  imageUrl: string;
  occlusions: Occlusion[];
  questionOcclusionId: number;
  isFlipped: boolean;
  onClick: () => void;
}

const ImageOcclusionPlayer = ({ imageUrl, occlusions, questionOcclusionId, isFlipped, onClick }: ImageOcclusionPlayerProps) => {
  return (
    <div className="w-full h-auto max-w-2xl cursor-pointer" onClick={onClick}>
      <Card>
        <CardContent className="p-2">
          <div className="relative">
            <img src={imageUrl} alt="Study card" className="w-full h-auto" />
            <svg className="absolute top-0 left-0 w-full h-full">
              {occlusions.map(occ => {
                const isQuestion = occ.id === questionOcclusionId;
                if (isFlipped && isQuestion) {
                  // Don't render the question block when flipped, revealing the answer
                  return null;
                }
                
                const fillColor = isQuestion ? "fill-blue-500/80" : "fill-primary/80";
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageOcclusionPlayer;
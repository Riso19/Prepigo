import { Card, CardContent } from "@/components/ui/card";
import { Occlusion } from "@/data/decks";
import { useState, useRef, useEffect } from 'react';

interface ImageOcclusionPlayerProps {
  imageUrl: string;
  occlusions: Occlusion[];
  questionOcclusionId: number;
  description?: string;
  isFlipped: boolean;
  onClick: () => void;
}

const ImageOcclusionPlayer = ({ imageUrl, occlusions, questionOcclusionId, description, isFlipped, onClick }: ImageOcclusionPlayerProps) => {
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imageUrl && imgRef.current) {
      const imgElement = imgRef.current;
      const handleLoad = () => {
        setImgDimensions({ width: imgElement.naturalWidth, height: imgElement.naturalHeight });
      };
      
      if (imgElement.complete) {
        handleLoad();
      } else {
        imgElement.addEventListener('load', handleLoad);
      }
      
      return () => {
        imgElement.removeEventListener('load', handleLoad);
      };
    }
  }, [imageUrl]);

  return (
    <div className="w-full h-auto max-w-2xl cursor-pointer" onClick={onClick}>
      <Card>
        <CardContent className="p-0">
          <div className="relative">
            <img ref={imgRef} src={imageUrl} alt="Study card" className="w-full h-auto block rounded-t-lg" />
            {imgDimensions && (
              <svg 
                className="absolute top-0 left-0 w-full h-full"
                viewBox={`0 0 ${imgDimensions.width} ${imgDimensions.height}`}
              >
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
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
            )}
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
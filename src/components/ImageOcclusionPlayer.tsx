import { Card, CardContent } from "@/components/ui/card";
import { Occlusion } from "@/data/decks";
import { useState, useRef, useEffect } from 'react';
import { useResolvedMediaUrl } from '@/hooks/use-resolved-media-url';
import { HtmlRenderer } from "./HtmlRenderer";

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
  const resolvedImageUrl = useResolvedMediaUrl(imageUrl);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (resolvedImageUrl && imgRef.current) {
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
  }, [resolvedImageUrl]);

  return (
    <div className="w-full min-h-[20rem] max-w-2xl cursor-pointer" onClick={onClick}>
      <Card className="w-full flex flex-col">
        <CardContent className="p-0">
          <div className="relative flex items-center justify-center max-h-[60vh]">
            {resolvedImageUrl && <img ref={imgRef} src={resolvedImageUrl} alt="Study card" className="w-full h-auto block object-contain max-h-[60vh]" />}
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
              <HtmlRenderer html={description} className="prose dark:prose-invert max-w-none text-sm" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageOcclusionPlayer;
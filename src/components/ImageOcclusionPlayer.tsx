import { Card, CardContent } from "@/components/ui/card";
import { Occlusion } from "@/data/decks";
import { useState, useRef, useEffect, useCallback } from 'react';
import { useResolvedMediaUrl } from '@/hooks/use-resolved-media-url';
import { HtmlRenderer } from "./HtmlRenderer";
import { cn } from "@/lib/utils";

interface ImageOcclusionPlayerProps {
  imageUrl: string;
  occlusions: Occlusion[]; // Normalized
  questionOcclusionId: number;
  description?: string;
  isFlipped: boolean;
  onClick: () => void;
}

const ImageOcclusionPlayer = ({ imageUrl, occlusions, questionOcclusionId, description, isFlipped, onClick }: ImageOcclusionPlayerProps) => {
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [revealedOcclusions, setRevealedOcclusions] = useState<Set<number>>(new Set());
  const resolvedImageUrl = useResolvedMediaUrl(imageUrl);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setRevealedOcclusions(new Set());
  }, [imageUrl, questionOcclusionId]);

  useEffect(() => {
    if (resolvedImageUrl && imgRef.current) {
      const imgElement = imgRef.current;
      const handleLoad = () => {
        setImgDimensions({ width: imgElement.naturalWidth, height: imgElement.naturalHeight });
      };
      
      if (imgElement.complete) handleLoad();
      else imgElement.addEventListener('load', handleLoad);
      
      return () => imgElement.removeEventListener('load', handleLoad);
    }
  }, [resolvedImageUrl]);

  const handleOcclusionClick = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!isFlipped) {
      onClick();
      return;
    }
    setRevealedOcclusions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, [isFlipped, onClick]);

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
                  
                  // --- FRONT OF CARD ---
                  if (!isFlipped) {
                    if (isQuestion) {
                      return (
                        <rect
                          key={occ.id}
                          x={occ.x * imgDimensions.width}
                          y={occ.y * imgDimensions.height}
                          width={occ.width * imgDimensions.width}
                          height={occ.height * imgDimensions.height}
                          className="fill-blue-500"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    return null; // Hide all other masks on the front
                  }

                  // --- BACK OF CARD ---
                  if (isQuestion) {
                    return null; // Always hide the question mask on the back (it's the answer)
                  }

                  // For other masks, hide them if they've been revealed by a click
                  if (revealedOcclusions.has(occ.id)) {
                    return null;
                  }
                  
                  // Otherwise, show the other masks and make them interactive
                  return (
                    <rect
                      key={occ.id}
                      x={occ.x * imgDimensions.width}
                      y={occ.y * imgDimensions.height}
                      width={occ.width * imgDimensions.width}
                      height={occ.height * imgDimensions.height}
                      className="fill-primary cursor-pointer transition-opacity hover:opacity-80"
                      vectorEffect="non-scaling-stroke"
                      onClick={(e) => handleOcclusionClick(e, occ.id)}
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
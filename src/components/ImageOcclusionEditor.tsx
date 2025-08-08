import { useState, useRef, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Occlusion } from '@/data/decks';
import { X } from 'lucide-react';

interface ImageOcclusionEditorProps {
  onSave: (imageUrl: string, occlusions: Occlusion[]) => void;
}

const ImageOcclusionEditor = ({ onSave }: ImageOcclusionEditorProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [occlusions, setOcclusions] = useState<Occlusion[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setOcclusions([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const getSVGPoint = (e: MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!image) return;
    e.preventDefault();
    setIsDrawing(true);
    setStartPos(getSVGPoint(e));
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing || !startPos) return;
    e.preventDefault();
    const currentPos = getSVGPoint(e);
    const newRect = {
      id: -1, // temporary id
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(startPos.x - currentPos.x),
      height: Math.abs(startPos.y - currentPos.y),
    };
    // Live preview of the rectangle being drawn
    const tempOcclusions = occlusions.filter(o => o.id !== -1);
    setOcclusions([...tempOcclusions, newRect]);
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    setStartPos(null);
    
    const finalOcclusions = occlusions.filter(o => o.id !== -1);
    const newOcclusion = occlusions.find(o => o.id === -1);

    if (newOcclusion && newOcclusion.width > 5 && newOcclusion.height > 5) {
      setOcclusions([...finalOcclusions, { ...newOcclusion, id: Date.now() }]);
    } else {
      setOcclusions(finalOcclusions);
    }
  };

  const removeOcclusion = (id: number) => {
    setOcclusions(occlusions.filter(o => o.id !== id));
  };

  const handleSaveClick = () => {
    if (image && occlusions.length > 0) {
      onSave(image, occlusions.filter(o => o.id !== -1));
    }
  };

  return (
    <div className="space-y-4">
      {!image && <Input type="file" accept="image/*" onChange={handleFileChange} />}
      {image && (
        <>
          <div className="relative w-full select-none" onMouseUp={handleMouseUp}>
            <img src={image} alt="Occlusion base" className="max-w-full max-h-[70vh] block" />
            <svg
              ref={svgRef}
              className="absolute top-0 left-0 w-full h-full cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
            >
              {occlusions.map((occ) => (
                <g key={occ.id}>
                  <rect
                    x={occ.x}
                    y={occ.y}
                    width={occ.width}
                    height={occ.height}
                    className="fill-primary/70 stroke-primary-foreground stroke-2"
                  />
                </g>
              ))}
            </svg>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveClick} disabled={occlusions.length === 0}>
              Save Flashcards ({occlusions.filter(o => o.id !== -1).length} created)
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Occlusions:</h4>
            {occlusions.filter(o => o.id !== -1).map((occ, index) => (
              <div key={occ.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                <span>Occlusion {index + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => removeOcclusion(occ.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageOcclusionEditor;
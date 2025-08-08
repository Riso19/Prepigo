import { useState, useRef, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Occlusion } from '@/data/decks';
import { showError } from '@/utils/toast';
import { X, Upload, Link as LinkIcon } from 'lucide-react';

interface ImageOcclusionEditorProps {
  onSave: (imageUrl: string, occlusions: Occlusion[]) => void;
}

const ImageOcclusionEditor = ({ onSave }: ImageOcclusionEditorProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [occlusions, setOcclusions] = useState<Occlusion[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  
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

  const handleUrlLoad = async () => {
    if (!imageUrlInput || !imageUrlInput.startsWith('http')) {
      showError('Please enter a valid image URL.');
      return;
    }
    try {
      // We use a proxy to get around CORS issues. This is a public proxy.
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const response = await fetch(proxyUrl + encodeURIComponent(imageUrlInput));
      if (!response.ok) {
        throw new Error(`Failed to fetch image. Status: ${response.status}`);
      }
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setOcclusions([]);
      };
      reader.onerror = () => {
        throw new Error('Failed to read image data.');
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error fetching image from URL:", error);
      showError("Could not load image. The URL may be invalid or the source may be blocking requests.");
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
      {!image && (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <Label>Upload from computer</Label>
            </div>
            <Input type="file" accept="image/*" onChange={handleFileChange} />
            <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">OR</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-muted-foreground" />
                <Label>Load from URL</Label>
            </div>
            <div className="flex gap-2">
                <Input 
                    type="text" 
                    placeholder="https://example.com/image.png" 
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                />
                <Button onClick={handleUrlLoad}>Load</Button>
            </div>
        </div>
      )}
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
                    className="fill-primary stroke-primary-foreground stroke-2"
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
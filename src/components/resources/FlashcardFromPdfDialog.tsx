import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ResourceItem } from "@/lib/dexie-db";
import { useDecks } from "@/contexts/DecksContext";

export type PdfSelection = {
  text: string;
  page: number;
  rects?: { x: number; y: number; w: number; h: number; page: number }[];
};

type OcclusionMask = { id?: number; x: number; y: number; width: number; height: number };
type OcclusionSeed = { imageUrl: string; masks?: OcclusionMask[] };

function OcclusionEditor({ imageUrl, onChange }: { imageUrl: string; onChange: (m: OcclusionMask[]) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);
  const [masks, setMasks] = useState<OcclusionMask[]>([]);
  const [creating, setCreating] = useState<{ startX: number; startY: number; x: number; y: number; w: number; h: number } | null>(null);
  const [selectedMask, setSelectedMask] = useState<number | null>(null);
  const [mode, setMode] = useState<'add' | 'select'>('add');
  const [dragInfo, setDragInfo] = useState<{ idx: number; startX: number; startY: number; maskStart: {x:number;y:number}; } | null>(null);
  const [resizeInfo, setResizeInfo] = useState<{ idx: number; handle: string; startX: number; startY: number; startRect: OcclusionMask } | null>(null);

  useEffect(() => { onChange(masks); }, [masks, onChange]);

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const announce = (msg: string) => { if (liveRef.current) liveRef.current.textContent = msg; };

  const getRel = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  // Creation (add mode)
  const startCreate = (x: number, y: number) => {
    setCreating({ startX: x, startY: y, x, y, w: 0, h: 0 });
    setSelectedMask(null);
  };
  const updateCreate = (x: number, y: number) => {
    if (!creating) return;
    setCreating({ ...creating, x, y, w: x - creating.startX, h: y - creating.startY });
  };
  const endCreate = () => {
    if (!creating) return;
    const x = clamp01(Math.min(creating.startX, creating.x));
    const y = clamp01(Math.min(creating.startY, creating.y));
    const w = clamp01(Math.abs(creating.w));
    const h = clamp01(Math.abs(creating.h));
    if (w > 0.02 && h > 0.02) {
      const nx = clamp01(x);
      const ny = clamp01(y);
      const nw = clamp01(Math.min(w, 1 - nx));
      const nh = clamp01(Math.min(h, 1 - ny));
      setMasks((prev) => [...prev, { x: nx, y: ny, width: nw, height: nh }]);
    }
    setCreating(null);
  };

  // Selection/drag/resize helpers
  const hitTestHandle = (m: OcclusionMask, x: number, y: number) => {
    // returns handle id or null; handles: n, s, e, w, ne, nw, se, sw
    const pad = 0.02; // 2% hit area
    const left = m.x, top = m.y, right = m.x + m.width, bottom = m.y + m.height;
    const near = (a: number, b: number) => Math.abs(a - b) <= pad;
    const insideX = x >= left - pad && x <= right + pad;
    const insideY = y >= top - pad && y <= bottom + pad;
    if (!(insideX && insideY)) return null;
    const onW = near(x, left);
    const onE = near(x, right);
    const onN = near(y, top);
    const onS = near(y, bottom);
    if (onN && onW) return 'nw';
    if (onN && onE) return 'ne';
    if (onS && onW) return 'sw';
    if (onS && onE) return 'se';
    if (onN) return 'n';
    if (onS) return 's';
    if (onW) return 'w';
    if (onE) return 'e';
    return null;
  };

  const hitTestMask = (m: OcclusionMask, x: number, y: number) => x >= m.x && x <= m.x + m.width && y >= m.y && y <= m.y + m.height;

  const onPointerDown = (clientX: number, clientY: number) => {
    const { x, y } = getRel(clientX, clientY);
    if (mode === 'add') {
      startCreate(x, y);
      return;
    }
    // select mode
    let idx = -1;
    // Prefer top-most mask (last drawn)
    for (let i = masks.length - 1; i >= 0; i--) {
      if (hitTestMask(masks[i], x, y)) { idx = i; break; }
    }
    if (idx >= 0) {
      setSelectedMask(idx);
      const handle = hitTestHandle(masks[idx], x, y);
      if (handle) {
        setResizeInfo({ idx, handle, startX: x, startY: y, startRect: { ...masks[idx] } });
      } else {
        setDragInfo({ idx, startX: x, startY: y, maskStart: { x: masks[idx].x, y: masks[idx].y } });
      }
    } else {
      setSelectedMask(null);
    }
  };

  const onPointerMove = (clientX: number, clientY: number) => {
    const { x, y } = getRel(clientX, clientY);
    if (creating) {
      updateCreate(x, y);
      return;
    }
    if (dragInfo) {
      const dx = x - dragInfo.startX;
      const dy = y - dragInfo.startY;
      setMasks((prev) => prev.map((m, i) => i !== dragInfo.idx ? m : {
        ...m,
        x: clamp01(Math.min(1 - m.width, Math.max(0, dragInfo.maskStart.x + dx))),
        y: clamp01(Math.min(1 - m.height, Math.max(0, dragInfo.maskStart.y + dy))),
      }));
      return;
    }
    if (resizeInfo) {
      const sr = resizeInfo.startRect;
      let nx = sr.x, ny = sr.y, nw = sr.width, nh = sr.height;
      const rx = x - resizeInfo.startX;
      const ry = y - resizeInfo.startY;
      switch (resizeInfo.handle) {
        case 'w': nx = clamp01(Math.min(sr.x + sr.width, Math.max(0, sr.x + rx))); nw = clamp01(sr.width + (sr.x - nx)); break;
        case 'e': nw = clamp01(Math.min(1 - sr.x, Math.max(0.02, sr.width + rx))); break;
        case 'n': ny = clamp01(Math.min(sr.y + sr.height, Math.max(0, sr.y + ry))); nh = clamp01(sr.height + (sr.y - ny)); break;
        case 's': nh = clamp01(Math.min(1 - sr.y, Math.max(0.02, sr.height + ry))); break;
        case 'nw': nx = clamp01(Math.min(sr.x + sr.width - 0.02, Math.max(0, sr.x + rx))); nw = clamp01(sr.width + (sr.x - nx)); ny = clamp01(Math.min(sr.y + sr.height - 0.02, Math.max(0, sr.y + ry))); nh = clamp01(sr.height + (sr.y - ny)); break;
        case 'ne': ny = clamp01(Math.min(sr.y + sr.height - 0.02, Math.max(0, sr.y + ry))); nh = clamp01(sr.height + (sr.y - ny)); nw = clamp01(Math.min(1 - sr.x, Math.max(0.02, sr.width + rx))); break;
        case 'sw': nx = clamp01(Math.min(sr.x + sr.width - 0.02, Math.max(0, sr.x + rx))); nw = clamp01(sr.width + (sr.x - nx)); nh = clamp01(Math.min(1 - sr.y, Math.max(0.02, sr.height + ry))); break;
        case 'se': nw = clamp01(Math.min(1 - sr.x, Math.max(0.02, sr.width + rx))); nh = clamp01(Math.min(1 - sr.y, Math.max(0.02, sr.height + ry))); break;
      }
      // Ensure within bounds
      nx = clamp01(Math.min(nx, 1 - nw));
      ny = clamp01(Math.min(ny, 1 - nh));
      setMasks((prev) => prev.map((m, i) => i !== resizeInfo.idx ? m : ({ ...m, x: nx, y: ny, width: nw, height: nh })));
    }
  };

  const onPointerUp = () => {
    if (creating) endCreate();
    setDragInfo(null);
    setResizeInfo(null);
  };

  const removeMask = (index: number) => {
    setMasks((prev) => prev.filter((_, i) => i !== index));
    if (selectedMask === index) setSelectedMask(null);
    announce(`Removed mask ${index + 1}`);
  };

  const removeSelected = () => {
    if (selectedMask !== null) {
      removeMask(selectedMask);
    }
  };

  const removeLast = () => {
    if (masks.length > 0) {
      setMasks((prev) => prev.slice(0, -1));
      if (selectedMask === masks.length - 1) setSelectedMask(null);
      announce('Removed last mask');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedMask !== null) removeMask(selectedMask);
    }
    if (e.key === 'Escape') setSelectedMask(null);
    const step = e.shiftKey ? 0.05 : 0.01;
    if (selectedMask !== null) {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) e.preventDefault();
      setMasks((prev) => prev.map((m, i) => {
        if (i !== selectedMask) return m;
        let nx = m.x, ny = m.y;
        if (e.key === 'ArrowLeft') nx = clamp01(Math.max(0, m.x - step));
        if (e.key === 'ArrowRight') nx = clamp01(Math.min(1 - m.width, m.x + step));
        if (e.key === 'ArrowUp') ny = clamp01(Math.max(0, m.y - step));
        if (e.key === 'ArrowDown') ny = clamp01(Math.min(1 - m.height, m.y + step));
        return { ...m, x: nx, y: ny };
      }));
    }
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => onPointerDown(e.clientX, e.clientY);
  const handleMouseMove = (e: React.MouseEvent) => onPointerMove(e.clientX, e.clientY);
  const handleMouseUp = () => onPointerUp();

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) onPointerDown(t.clientX, t.clientY);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) onPointerMove(t.clientX, t.clientY);
  };
  const handleTouchEnd = () => onPointerUp();

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium" id="occl-title">Image Occlusion Editor</div>

      {/* Mode selector */}
      <div className="flex items-center gap-2">
        <Button
          variant={mode === 'add' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('add')}
        >
          Add Masks
        </Button>
        <Button
          variant={mode === 'select' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('select')}
        >
          Select Masks
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {masks.length} mask{masks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Editor canvas */}
      <div className="relative mx-auto w-full max-w-4xl rounded border bg-gray-50 overflow-auto max-h-96">
        <div
          ref={containerRef}
          className="relative min-h-64"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="application"
          aria-labelledby="occl-title"
          aria-describedby="occl-help"
          style={{ cursor: mode === 'add' ? 'crosshair' : (resizeInfo ? 'nwse-resize' : dragInfo ? 'grabbing' : 'default') }}
        >
          <img src={imageUrl} alt="PDF selection" className="w-full h-auto object-contain select-none pointer-events-none" />

          {/* Render masks */}
          <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
            {masks.map((m, i) => {
              const isSel = selectedMask === i;
              return (
                <div
                  key={i}
                  className={`absolute outline outline-2 ${isSel ? 'bg-red-500/60 outline-red-400' : 'bg-black/70 outline-white'}`}
                  style={{ left: `${m.x*100}%`, top: `${m.y*100}%`, width: `${m.width*100}%`, height: `${m.height*100}%` }}
                  role="button"
                  aria-label={`Mask ${i + 1} at ${Math.round(m.x*100)}%, ${Math.round(m.y*100)}%`}
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); if (mode === 'select') setSelectedMask(i); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (mode === 'select') setSelectedMask(i); } }}
                >
                  {/* Resize handles (visible in select mode and when selected) */}
                  {mode === 'select' && isSel && (
                    <>
                      {['nw','n','ne','e','se','s','sw','w'].map((h) => (
                        <div
                          key={h}
                          className={`absolute bg-white border border-gray-400 rounded-sm`}
                          style={{
                            width: '12px', height: '12px',
                            left: h.includes('w') ? '-6px' : h.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                            top: h.includes('n') ? '-6px' : h.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                            cursor: h === 'n' || h === 's' ? 'ns-resize' : h === 'e' || h === 'w' ? 'ew-resize' : h === 'ne' || h === 'sw' ? 'nesw-resize' : 'nwse-resize',
                          }}
                          onMouseDown={(e) => { e.stopPropagation(); const { x, y } = getRel(e.clientX, e.clientY); setResizeInfo({ idx: i, handle: h, startX: x, startY: y, startRect: { ...m } }); }}
                          onTouchStart={(e) => { e.stopPropagation(); const t = e.touches[0]; if (!t) return; const { x, y } = getRel(t.clientX, t.clientY); setResizeInfo({ idx: i, handle: h, startX: x, startY: y, startRect: { ...m } }); }}
                        />
                      ))}
                    </>
                  )}
                </div>
              );
            })}

            {/* Preview creating mask */}
            {creating && (
              <div
                className="absolute bg-blue-500/40 outline outline-2 outline-blue-400"
                style={{
                  left: `${Math.min(creating.startX, creating.x)*100}%`,
                  top: `${Math.min(creating.startY, creating.y)*100}%`,
                  width: `${Math.abs(creating.w)*100}%`,
                  height: `${Math.abs(creating.h)*100}%`
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 text-xs">
        <Button variant="outline" size="sm" onClick={removeLast} disabled={masks.length === 0}>
          Remove Last
        </Button>
        <Button variant="outline" size="sm" onClick={removeSelected} disabled={selectedMask === null}>
          Remove Selected
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setMasks([]); setSelectedMask(null); announce('Cleared all masks'); }} disabled={masks.length === 0}>
          Clear All
        </Button>
        <div className="ml-auto text-muted-foreground" id="occl-help">
          {mode === 'add' ? 'Drag to add masks' : 'Click a mask to select, then drag or use handles to resize. Arrow keys to nudge; Shift for larger steps.'}
        </div>
      </div>

      {selectedMask !== null && (
        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-2">
          <strong>Mask {selectedMask + 1} selected</strong> - Press Delete/Backspace, or use Arrow keys to nudge
        </div>
      )}

      {/* aria-live region for announcements */}
      <div ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  );
}

export default function FlashcardFromPdfDialog({
  open,
  onOpenChange,
  resource: _resource,
  selection,
  occlusionSeed,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resource: ResourceItem;
  selection: PdfSelection | null;
  occlusionSeed?: OcclusionSeed | null;
  onCreate: (payload: {
    deckId: string;
    front: string;
    back: string;
    linkHighlight: boolean;
    cardType: 'basic' | 'imageOcclusion';
    masks?: OcclusionMask[];
  }) => void;
}) {
  const { decks } = useDecks();
  const [deckId, setDeckId] = useState<string>(decks[0]?.id ?? "");
  const [front, setFront] = useState<string>(selection?.text ?? "");
  const [back, setBack] = useState<string>("");
  const [linkHighlight, setLinkHighlight] = useState<boolean>(true);
  const [cardType, setCardType] = useState<'basic'|'imageOcclusion'>('basic');
  const [masks, setMasks] = useState<OcclusionMask[]>([]);

  useEffect(() => {
    setFront(selection?.text ?? "");
  }, [selection?.text]);

  // Reset masks when dialog opens or seed changes
  useEffect(() => {
    if (open) {
      setMasks([]);
    }
  }, [open, occlusionSeed?.imageUrl]);

  // Keep local deck options in state if needed later

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto sm:max-w-5xl max-h-[90vh] h-[90vh] sm:h-auto overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Create flashcard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="deck">Deck</Label>
            <Select value={deckId} onValueChange={setDeckId}>
              <SelectTrigger id="deck"><SelectValue placeholder="Select a deck"/></SelectTrigger>
              <SelectContent>
                {decks.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="front">Front</Label>
            <Input id="front" value={front} onChange={(e)=>setFront(e.target.value)} placeholder="Question / prompt"/>
          </div>
          <div>
            <Label htmlFor="back">Back</Label>
            <Input id="back" value={back} onChange={(e)=>setBack(e.target.value)} placeholder="Answer"/>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Link highlight to card</div>
              <div className="text-xs text-muted-foreground">Include PDF source metadata and link this highlight.</div>
            </div>
            <Switch checked={linkHighlight} onCheckedChange={setLinkHighlight} aria-label="Link highlight" />
          </div>
          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Card type</div>
            <RadioGroup value={cardType} onValueChange={(v)=>setCardType(v as 'basic' | 'imageOcclusion')} className="grid grid-cols-2 gap-2">
              <Label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer" htmlFor="ct-basic">
                <RadioGroupItem id="ct-basic" value="basic"/> Normal
              </Label>
              <Label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer" htmlFor="ct-occl">
                <RadioGroupItem id="ct-occl" value="imageOcclusion"/> Image occlusion
              </Label>
            </RadioGroup>
          </div>
          {cardType === 'imageOcclusion' && (
            occlusionSeed?.imageUrl ? (
              <OcclusionEditor imageUrl={occlusionSeed.imageUrl} onChange={setMasks} />
            ) : (
              <div className="rounded border p-4 bg-amber-50 border-amber-200">
                <div className="text-sm font-medium text-amber-800 mb-1">No PDF area selected</div>
                <div className="text-xs text-amber-700">Please highlight or select an area in the PDF first to enable the image occlusion editor.</div>
              </div>
            )
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() =>
              onCreate({ deckId, front, back, linkHighlight, cardType, masks })
            }
            disabled={!deckId || (!front && cardType !== 'imageOcclusion') || (cardType === 'imageOcclusion' && (!occlusionSeed?.imageUrl || masks.length === 0))}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

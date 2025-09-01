import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useResources } from '@/contexts/ResourcesContext';
import {
  getResourceById,
  type ResourceItem,
  getHighlightsForResource,
  saveResourceHighlight,
  linkHighlightToCard,
  updateResourceHighlight,
  deleteResourceHighlight,
  type ResourceHighlight,
  setResourceProgress,
  getResourceProgress,
} from '@/lib/dexie-db';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Highlighter,
  StickyNote,
  Copy,
  Paintbrush,
  List,
  Trash2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import FlashcardFromPdfDialog, {
  type PdfSelection,
} from '@/components/resources/FlashcardFromPdfDialog';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min?url';
import Header from '@/components/Header';
import { useDecks } from '@/contexts/DecksContext';
import type { DeckData, FlashcardData } from '@/data/decks';

GlobalWorkerOptions.workerSrc = pdfWorker as string;

export default function ResourceViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getBlobUrl } = useResources();
  const { setDecks } = useDecks();

  const [resource, setResource] = useState<ResourceItem | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [pageCount, setPageCount] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const [rendering, setRendering] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1.5);
  const [textItems, setTextItems] = useState<
    Array<{
      str: string;
      x: number;
      y: number;
      w: number;
      h: number; // page space (scale 1)
    }>
  >([]);

  // Selection placeholder for v1: no text layer yet; allow manual edit in dialog
  const [selection, setSelection] = useState<PdfSelection | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [highlights, setHighlights] = useState<ResourceHighlight[]>([]);
  const [currentHighlightId, setCurrentHighlightId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [noteForId, setNoteForId] = useState<string | null>(null);
  const [createOnSelect, setCreateOnSelect] = useState<boolean>(true);
  const [occlusionSeed, setOcclusionSeed] = useState<{
    imageUrl: string;
    masks?: { x: number; y: number; width: number; height: number }[];
  } | null>(null);

  // Load resource
  useEffect(() => {
    (async () => {
      if (!id) return;
      const r = await getResourceById(id);
      if (!r) return;
      setResource(r);
      const url = await getBlobUrl(r);
      if (url) setBlobUrl(url);
      // load highlights for this resource
      const hs = await getHighlightsForResource(r.id);
      setHighlights(hs);
    })();
  }, [id]);

  // Keep occlusion seed in sync with current selection and scale
  useEffect(() => {
    if (!selection?.rects?.length || selection.page !== pageNum) {
      setOcclusionSeed(null);
      return;
    }

    // Wait a bit for canvas to be ready after rendering
    const timer = setTimeout(() => {
      const crop = getSelectionImageDataUrl();
      if (crop) {
        // Start with no masks - user will add them manually
        setOcclusionSeed({ imageUrl: crop.dataUrl, masks: [] });
        console.log('Occlusion seed set:', { hasImage: !!crop.dataUrl, maskCount: 0 });
      } else {
        setOcclusionSeed(null);
        console.log('Failed to get crop from selection');
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selection?.rects, selection?.page, pageNum, scale]);

  // Load PDF
  useEffect(() => {
    (async () => {
      if (!blobUrl) return;
      const doc = await getDocument(blobUrl).promise;
      setPdf(doc);
      setPageCount(doc.numPages);
      // try restore progress
      if (resource) {
        const prog = await getResourceProgress(resource.id).catch(() => undefined);
        if (prog && prog.page >= 1 && prog.page <= doc.numPages) {
          setPageNum(prog.page);
        } else {
          setPageNum(1);
        }
      } else {
        setPageNum(1);
      }
    })();
  }, [blobUrl]);

  // Render current page
  useEffect(() => {
    (async () => {
      if (!pdf) return;
      setRendering(true);
      try {
        const page: PDFPageProxy = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Use device pixel ratio for crisp rendering
        const devicePixelRatio = window.devicePixelRatio || 1;
        const outputScale = devicePixelRatio;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
          ...(transform && { transform }),
        }).promise;

        // Load text content and compute simple bounding boxes
        const textContent = await page.getTextContent();
        type PdfTextItem = { str: string; transform: number[]; width: number };
        const items: Array<{ str: string; x: number; y: number; w: number; h: number }> = [];
        for (const it of textContent.items as unknown as PdfTextItem[]) {
          const str: string = it.str;
          const tf: number[] = it.transform; // [a,b,c,d,e,f]
          const x = tf[4];
          const yTop = tf[5];
          const h = Math.abs(tf[3]);
          const w: number = it.width; // in page units
          const y = yTop - h; // convert top to bottom origin
          if (w > 0 && h > 0 && str) items.push({ str, x, y, w, h });
        }
        setTextItems(items);
        // Save progress
        if (resource) {
          await setResourceProgress(resource.id, pageNum, pageCount);
        }
      } finally {
        setRendering(false);
      }
    })();
  }, [pdf, pageNum, scale]);

  // Mouse handling for rectangular selection overlay
  const onMouseDown = (e: React.MouseEvent) => {
    const wrap = canvasWrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStart({ x, y });
    setDragRect({ x, y, w: 0, h: 0 });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = x - dragStart.x;
    const h = y - dragStart.y;
    setDragRect({
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      w: Math.abs(w),
      h: Math.abs(h),
    });
  };

  const onMouseUp = async () => {
    if (!dragStart || !dragRect || !resource) {
      setDragStart(null);
      setDragRect(null);
      return;
    }
    // convert to PDF page coordinates (scale 1)
    const page = pdf && (await pdf.getPage(pageNum));
    const viewport = page && page.getViewport({ scale });
    let text = '';
    if (viewport) {
      // Build selection rect in viewport space (top-left origin) which is our dragRect already
      const selV = { x: dragRect.x, y: dragRect.y, w: dragRect.w, h: dragRect.h };
      const overlaps = (
        a: { x: number; y: number; w: number; h: number },
        b: { x: number; y: number; w: number; h: number },
      ) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      // Convert text items into viewport rectangles and test overlap
      const viewportItems = textItems.map((t) => {
        const [vx1, vy1] = viewport.convertToViewportPoint(t.x, t.y);
        const [vx2, vy2] = viewport.convertToViewportPoint(t.x + t.w, t.y + t.h);
        const x = Math.min(vx1, vx2);
        const y = Math.min(vy1, vy2);
        const w = Math.abs(vx2 - vx1);
        const h = Math.abs(vy2 - vy1);
        return { str: t.str, x, y, w, h };
      });
      text = viewportItems
        .filter((v) => overlaps(v, selV))
        .map((v) => v.str)
        .join(' ');
    }
    const pageRect = {
      x: dragRect.x / scale,
      y: dragRect.y / scale,
      w: dragRect.w / scale,
      h: dragRect.h / scale,
    };
    const highlight: ResourceHighlight = {
      id: crypto.randomUUID?.() ?? `hl-${Date.now()}`,
      resourceId: resource.id,
      page: pageNum,
      rects: [{ ...pageRect, page: pageNum }],
      createdAt: Date.now(),
      text: text || undefined,
    };
    await saveResourceHighlight(highlight);
    setHighlights((prev) => [...prev, highlight]);
    setSelection({ text: text || '', page: pageNum, rects: highlight.rects });
    setCurrentHighlightId(highlight.id);
    if (createOnSelect) {
      setDialogOpen(true);
    }
    setDragStart(null);
    setDragRect(null);
  };

  // Cycle highlight color on shift-click
  const cycleColor = (c?: 'yellow' | 'green' | 'blue' | 'pink') => {
    const order: Array<'yellow' | 'green' | 'blue' | 'pink'> = ['yellow', 'green', 'blue', 'pink'];
    if (!c) return 'yellow';
    const idx = order.indexOf(c);
    return order[(idx + 1) % order.length];
  };

  const onHighlightClick = async (
    e: React.MouseEvent | React.KeyboardEvent,
    h: ResourceHighlight,
  ) => {
    if (e.shiftKey) {
      const newColor = cycleColor(h.color);
      await updateResourceHighlight(h.id, { color: newColor });
      setHighlights((prev) => prev.map((x) => (x.id === h.id ? { ...x, color: newColor } : x)));
      return;
    }
    // Select highlight
    setCurrentHighlightId(h.id);
    setSelection({ text: h.text || '', page: h.page, rects: h.rects });
  };

  const setColorForHighlight = async (id: string, color: 'yellow' | 'green' | 'blue' | 'pink') => {
    await updateResourceHighlight(id, { color });
    setHighlights((prev) => prev.map((x) => (x.id === id ? { ...x, color } : x)));
  };

  const openNoteEditor = (h: ResourceHighlight) => {
    setNoteForId(h.id);
    setNoteDraft(h.note ?? '');
  };

  const saveNote = async () => {
    if (!noteForId) return;
    await updateResourceHighlight(noteForId, { note: noteDraft });
    setHighlights((prev) => prev.map((x) => (x.id === noteForId ? { ...x, note: noteDraft } : x)));
    setNoteForId(null);
    setNoteDraft('');
  };

  const copySelectionText = async () => {
    const txt = selection?.text?.trim();
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
    } catch (e) {
      // Ignore clipboard errors
    }
  };

  // Helper: get data URL for selection region
  const getSelectionImageDataUrl = (): {
    dataUrl: string;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
  } | null => {
    const canvas = canvasRef.current;
    if (!canvas || !selection?.rects?.length) return null;

    // Account for device pixel ratio scaling
    const devicePixelRatio = window.devicePixelRatio || 1;
    const outputScale = devicePixelRatio;

    // Compute bounding box of all rects (in canvas pixels, accounting for scaling)
    const rectsPx = selection.rects.map((r) => ({
      x: r.x * scale * outputScale,
      y: r.y * scale * outputScale,
      w: r.w * scale * outputScale,
      h: r.h * scale * outputScale,
    }));
    const minX = Math.floor(Math.min(...rectsPx.map((r) => r.x)));
    const minY = Math.floor(Math.min(...rectsPx.map((r) => r.y)));
    const maxX = Math.ceil(Math.max(...rectsPx.map((r) => r.x + r.w)));
    const maxY = Math.ceil(Math.max(...rectsPx.map((r) => r.y + r.h)));
    const sw = Math.max(1, maxX - minX);
    const sh = Math.max(1, maxY - minY);

    const off = document.createElement('canvas');
    off.width = sw;
    off.height = sh;
    const ctx = off.getContext('2d');
    if (!ctx) return null;

    // Draw the cropped region from the high-DPI canvas
    ctx.drawImage(canvas, minX, minY, sw, sh, 0, 0, sw, sh);

    try {
      return {
        dataUrl: off.toDataURL('image/png'),
        cropX: minX / outputScale,
        cropY: minY / outputScale,
        cropW: sw / outputScale,
        cropH: sh / outputScale,
      };
    } catch {
      return null;
    }
  };

  const onCreateCard = async (payload: {
    deckId: string;
    front: string;
    back: string;
    linkHighlight: boolean;
    cardType: 'basic' | 'imageOcclusion';
    masks?: { x: number; y: number; width: number; height: number }[];
  }) => {
    if (!resource) return;
    let newCard: FlashcardData;
    if (payload.cardType === 'imageOcclusion') {
      const crop = occlusionSeed ?? getSelectionImageDataUrl();
      if (!crop) {
        alert('Please select an area in the PDF first to create an image occlusion card.');
        return;
      }

      const occlusions = (payload.masks ?? []).map((m, idx) => ({ id: idx + 1, ...m }));
      if (occlusions.length === 0) {
        alert('Please add at least one occlusion mask to create an image occlusion card.');
        return;
      }

      newCard = {
        id: crypto.randomUUID?.() ?? `card-${Date.now()}`,
        type: 'imageOcclusion' as const,
        imageUrl: 'dataUrl' in crop ? crop.dataUrl : crop.imageUrl,
        occlusions,
        questionOcclusionId: occlusions[0].id, // First mask is the question
        sourceType: 'pdf' as const,
        sourceResourceId: resource.id,
        sourcePage: selection?.page ?? pageNum,
        sourceRects: selection?.rects,
        sourceCreatedAt: Date.now(),
      };
    } else {
      // Create a basic card with PDF source metadata
      newCard = {
        id: crypto.randomUUID?.() ?? `card-${Date.now()}`,
        type: 'basic' as const,
        question: payload.front,
        answer: payload.back,
        sourceType: 'pdf' as const,
        sourceResourceId: resource.id,
        sourcePage: selection?.page ?? pageNum,
        sourceText: selection?.text,
        sourceRects: selection?.rects,
        sourceCreatedAt: Date.now(),
      };
    }

    const addToDeck = (ds: DeckData[]): DeckData[] => {
      const addRec = (d: DeckData): DeckData => {
        if (d.id === payload.deckId) {
          return { ...d, flashcards: [...d.flashcards, newCard] };
        }
        if (d.subDecks?.length) {
          return { ...d, subDecks: d.subDecks.map(addRec) };
        }
        return d;
      };
      return ds.map(addRec);
    };

    setDecks((prev) => addToDeck(prev));
    if (payload.linkHighlight && currentHighlightId) {
      await linkHighlightToCard(currentHighlightId, newCard.id);
      setHighlights((prev) =>
        prev.map((h) => (h.id === currentHighlightId ? { ...h, linkedCardId: newCard.id } : h)),
      );
      setCurrentHighlightId(null);
    }
    setDialogOpen(false);
  };

  const canPrev = pageNum > 1;
  const canNext = pageNum < pageCount;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-3 sm:py-4">
        <Button variant="ghost" className="mb-3 gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <Card className="p-3 sm:p-4 flex flex-col min-h-[70vh]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="font-medium text-foreground">{resource?.title ?? 'PDF'}</span>
              <span>
                • Page {pageNum} / {pageCount}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => canPrev && setPageNum((p) => Math.max(1, p - 1))}
                disabled={!canPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => canNext && setPageNum((p) => Math.min(pageCount, p + 1))}
                disabled={!canNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-1 text-xs">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
                >
                  -
                </Button>
                <div className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
                >
                  +
                </Button>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  setSelection({ text: '', page: pageNum });
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Create flashcard
              </Button>
              <Sheet open={showHighlights} onOpenChange={setShowHighlights}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <List className="h-4 w-4" /> Highlights
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-[420px] flex flex-col">
                  <SheetHeader>
                    <SheetTitle>Highlights</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
                    {highlights.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No highlights yet. Drag on the page to create one.
                      </div>
                    )}
                    {highlights
                      .sort((a, b) => a.page - b.page || a.createdAt - b.createdAt)
                      .map((h) => (
                        <div key={h.id} className="rounded-md border p-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div>Page {h.page}</div>
                            <div className="flex items-center gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Set color"
                                  >
                                    <Paintbrush className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setColorForHighlight(h.id, 'yellow')}
                                  >
                                    Yellow
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setColorForHighlight(h.id, 'green')}
                                  >
                                    Green
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setColorForHighlight(h.id, 'blue')}
                                  >
                                    Blue
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setColorForHighlight(h.id, 'pink')}
                                  >
                                    Pink
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Add note"
                                onClick={() => openNoteEditor(h)}
                              >
                                <StickyNote className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600"
                                title="Delete"
                                onClick={async () => {
                                  await deleteResourceHighlight(h.id);
                                  setHighlights((prev) => prev.filter((x) => x.id !== h.id));
                                  if (currentHighlightId === h.id) setCurrentHighlightId(null);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Go to"
                                onClick={() => {
                                  setPageNum(h.page);
                                }}
                              >
                                <ChevronRight className="h-4 w-4 rotate-180" />
                              </Button>
                            </div>
                          </div>
                          {h.text && <div className="mt-1 text-sm">{h.text}</div>}
                          {h.note && (
                            <div className="mt-1 text-xs text-muted-foreground">Note: {h.note}</div>
                          )}
                        </div>
                      ))}
                  </div>
                  {noteForId && (
                    <div className="mt-4 border-t pt-3">
                      <div className="text-sm font-medium mb-2">Edit note</div>
                      <Textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={4}
                        placeholder="Add a note"
                      />
                      <div className="mt-2 flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNoteForId(null);
                            setNoteDraft('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveNote}>
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          </div>
          {/* Reading progress bar */}
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 grow rounded bg-muted">
              <div
                className="h-2 rounded bg-primary"
                style={{ width: `${(pageNum / Math.max(1, pageCount)) * 100}%` }}
              />
            </div>
            <div className="text-xs tabular-nums text-muted-foreground">
              {Math.round((pageNum / Math.max(1, pageCount)) * 100)}%
            </div>
          </div>

          {/* Inline toolbar for current selection */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={!currentHighlightId && !selection}
              onClick={copySelectionText}
            >
              <Copy className="h-4 w-4" /> Copy text
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={!currentHighlightId}
                >
                  <Highlighter className="h-4 w-4" /> Color
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  disabled={!currentHighlightId}
                  onClick={() =>
                    currentHighlightId && setColorForHighlight(currentHighlightId, 'yellow')
                  }
                >
                  Yellow
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!currentHighlightId}
                  onClick={() =>
                    currentHighlightId && setColorForHighlight(currentHighlightId, 'green')
                  }
                >
                  Green
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!currentHighlightId}
                  onClick={() =>
                    currentHighlightId && setColorForHighlight(currentHighlightId, 'blue')
                  }
                >
                  Blue
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!currentHighlightId}
                  onClick={() =>
                    currentHighlightId && setColorForHighlight(currentHighlightId, 'pink')
                  }
                >
                  Pink
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={!currentHighlightId}
              onClick={() => {
                const h = highlights.find((x) => x.id === currentHighlightId);
                if (h) {
                  openNoteEditor(h);
                  setShowHighlights(true);
                }
              }}
            >
              <StickyNote className="h-4 w-4" /> Note
            </Button>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>Create card on select</span>
              <Switch
                checked={createOnSelect}
                onCheckedChange={setCreateOnSelect}
                aria-label="Create card on select"
              />
            </div>
            {/* OCR feature removed as per request */}
          </div>
          <div className="mt-3 relative flex-1 min-h-[50vh] sm:min-h-[60vh] overflow-auto">
            <div className="w-full h-full flex items-center justify-center">
              <div
                ref={canvasWrapRef}
                className="relative inline-block"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
              >
                <canvas
                  ref={canvasRef}
                  className={
                    'bg-muted rounded border block max-w-full h-auto' +
                    (rendering ? ' opacity-80' : '')
                  }
                />
                {/* Persisted highlights for current page */}
                {highlights
                  .filter((h) => h.page === pageNum)
                  .flatMap((h) =>
                    h.rects.map((r, idx) => {
                      const color = h.color ?? 'yellow';
                      const classes = {
                        yellow: 'bg-yellow-300/30 ring-yellow-500/50',
                        green: 'bg-green-300/30 ring-green-500/50',
                        blue: 'bg-blue-300/30 ring-blue-500/50',
                        pink: 'bg-pink-300/30 ring-pink-500/50',
                      }[color];
                      return (
                        <div
                          key={`${h.id}-${idx}`}
                          className={`absolute ${classes} ring-1 rounded-sm pointer-events-auto cursor-pointer`}
                          style={{
                            left: r.x * scale,
                            top: r.y * scale,
                            width: r.w * scale,
                            height: r.h * scale,
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`highlight ${color}`}
                          title={h.text || 'Highlight'}
                          onClick={(e) => onHighlightClick(e, h)}
                          onKeyDown={(e) => {
                            if (e.shiftKey && (e.key === 'Enter' || e.key === ' '))
                              onHighlightClick(e, h);
                          }}
                        />
                      );
                    }),
                  )}
                {/* Active drag rectangle */}
                {dragRect && (
                  <div
                    className="absolute bg-blue-300/20 ring-1 ring-blue-500/60 rounded-sm"
                    style={{
                      left: dragRect.x,
                      top: dragRect.y,
                      width: dragRect.w,
                      height: dragRect.h,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </Card>
        {resource && (
          <FlashcardFromPdfDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            resource={resource}
            selection={selection}
            occlusionSeed={occlusionSeed}
            onCreate={onCreateCard}
          />
        )}
      </div>
    </div>
  );
}

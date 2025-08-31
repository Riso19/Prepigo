import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
// Vite-friendly worker import
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

GlobalWorkerOptions.workerSrc = pdfWorker as string;

// Renders the first page of a PDF blob URL to a canvas and shows it as an image.
// Falls back to a gradient placeholder if rendering fails.
export default function PdfCover({ url, className }: { url: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loadingTask = getDocument(url);
        const pdf: PDFDocumentProxy = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current || document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context not available");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!mounted) return;
        setDataUrl(canvas.toDataURL("image/png"));
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to render PDF");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [url]);

  if (dataUrl) {
    return (
      <div className={`w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden ${className || ""}`}>
        <img src={dataUrl} alt="PDF cover" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`w-full aspect-[4/3] bg-gradient-to-br from-primary/15 to-secondary/40 flex items-center justify-center ${className || ""}`}>
      <span className="text-xs text-muted-foreground">{error ? "Preview unavailable" : "Generating preview..."}</span>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
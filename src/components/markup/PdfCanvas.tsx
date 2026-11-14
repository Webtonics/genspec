import { useEffect, useRef } from 'react';
import type { PDFPageProxy } from '@/pdf/pdf';
import { useUiStore } from '@/store/uiStore';

/** Browsers cap canvas size; stay under ~16 megapixels however far the user zooms. */
const MAX_PIXELS = 16_000_000;

/**
 * Renders one PDF page at the current zoom and device pixel ratio. Renders into
 * an offscreen canvas and swaps it in when done, so zooming never flashes white;
 * in between, the old bitmap is stretched by CSS. Re-renders are debounced.
 */
export function PdfCanvas({ page, zoom, onRendered }: { page: PDFPageProxy; zoom: number; onRendered?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firstRender = useRef(true);
  const mode = useUiStore((s) => s.mode);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let task: ReturnType<PDFPageProxy['render']> | undefined;

    const run = () => {
      const base = page.getViewport({ scale: 1 });
      let scale = zoom * (window.devicePixelRatio || 1);
      const pixels = base.width * base.height * scale * scale;
      if (pixels > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / pixels);
      const viewport = page.getViewport({ scale });
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.ceil(viewport.width);
      offscreen.height = Math.ceil(viewport.height);
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport });
      task.promise
        .then(() => {
          if (cancelled) return;
          canvas.width = offscreen.width;
          canvas.height = offscreen.height;
          canvas.getContext('2d')?.drawImage(offscreen, 0, 0);
          onRenderedRef.current?.();
        })
        .catch(() => {
          // Cancelled by a newer zoom level: nothing to do.
        });
    };

    const timer = window.setTimeout(run, firstRender.current ? 0 : 140);
    firstRender.current = false;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      task?.cancel();
    };
  }, [page, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ filter: mode === 'scada' ? 'url(#genspec-scada-pdf)' : undefined }}
      aria-hidden
    />
  );
}

/**
 * Recolours the drawing for SCADA mode on screen only: white paper becomes the
 * dark background and black linework becomes green. The PDF itself is untouched.
 */
export function ScadaPdfFilter() {
  // Each output channel = line + (background - line) x luminance, with line #00E87B and background #0B0F0E.
  const bg = [11 / 255, 15 / 255, 14 / 255];
  const line = [0, 232 / 255, 123 / 255];
  const lum = [0.2126, 0.7152, 0.0722];
  const row = (c: number) => [...lum.map((l) => ((bg[c] - line[c]) * l).toFixed(5)), 0, line[c].toFixed(5)].join(' ');
  const matrix = `${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0`;
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id="genspec-scada-pdf" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={matrix} />
      </filter>
    </svg>
  );
}

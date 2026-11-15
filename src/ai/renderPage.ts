/**
 * Renders a drawing page to images for the AI to read. A vector PDF sends the
 * whole sheet (its text layer carries the tags exactly). A scan has no text layer,
 * so it also sends four zoomed, overlapping quarters, where small print is legible.
 */
import type { DrawingText } from '@/markup/drawingText';
import type { PDFPageProxy } from '@/pdf/pdf';
import type { PageImage } from './types';

/** Longest side of each image sent, px. */
const IMAGE_PX = 2048;
/** Overlap between quarters, as a fraction of the page, so tags on the split lines are whole in one of them. */
const OVERLAP = 0.08;
/** Keep the request under the server's 4.2 MB limit. */
const MAX_TOTAL_CHARS = 3_800_000;
/** Fewer text runs than this and the page is treated as a scan. */
const SCAN_TEXT_RUNS = 15;

export const isScannedPage = (texts: DrawingText[]) => texts.length < SCAN_TEXT_RUNS;

async function renderToCanvas(page: PDFPageProxy, longestPx: number): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: longestPx / Math.max(base.width, base.height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot render the drawing.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

function crop(source: HTMLCanvasElement, fx: number, fy: number, fw: number, fh: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  const sx = Math.round(fx * source.width);
  const sy = Math.round(fy * source.height);
  out.width = Math.round(fw * source.width);
  out.height = Math.round(fh * source.height);
  out.getContext('2d')?.drawImage(source, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export async function renderPageImages(page: PDFPageProxy, scanned: boolean): Promise<PageImage[]> {
  const canvases: { label: string; canvas: HTMLCanvasElement }[] = [{ label: 'Whole sheet', canvas: await renderToCanvas(page, IMAGE_PX) }];
  if (scanned) {
    const big = await renderToCanvas(page, Math.round(IMAGE_PX / (0.5 + OVERLAP)));
    const size = 0.5 + OVERLAP;
    const far = 1 - size;
    canvases.push(
      { label: 'Top left quarter, zoomed', canvas: crop(big, 0, 0, size, size) },
      { label: 'Top right quarter, zoomed', canvas: crop(big, far, 0, size, size) },
      { label: 'Bottom left quarter, zoomed', canvas: crop(big, 0, far, size, size) },
      { label: 'Bottom right quarter, zoomed', canvas: crop(big, far, far, size, size) },
    );
  }
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const images = canvases.map(({ label, canvas }) => ({ label, url: canvas.toDataURL('image/jpeg', quality) }));
    if (images.reduce((n, img) => n + img.url.length, 0) <= MAX_TOTAL_CHARS) return images;
  }
  throw new Error('The drawing page is too detailed to send. Try a smaller PDF page.');
}

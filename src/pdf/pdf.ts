/**
 * pdfjs-dist setup and helpers. The client's PDF is only ever read here: markups
 * live on a separate overlay, so the original drawing is never altered.
 */
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { DrawingText } from '@/markup/drawingText';
import { type Matrix, type PathOps, type Segment, segmentsFromOperatorList } from '@/markup/lineSnap';
import type { Drawing } from '@/model/types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy, PDFPageProxy };

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/** Cheap fingerprint of a drawing, so the same PDF is parsed once per session. */
export function drawingKey(drawing: Pick<Drawing, 'fileName' | 'pdfBase64'>): string {
  const b = drawing.pdfBase64;
  return `${drawing.fileName}|${b.length}|${b.slice(0, 32)}|${b.slice(-48)}`;
}

const cache = new Map<string, Promise<PDFDocumentProxy>>();
const MAX_CACHED = 4;

export function loadPdf(drawing: Drawing): Promise<PDFDocumentProxy> {
  const key = drawingKey(drawing);
  const cached = cache.get(key);
  if (cached) return cached;
  // pdfjs transfers the buffer to its worker, so always hand it a fresh copy.
  const promise = pdfjs.getDocument({ data: base64ToBytes(drawing.pdfBase64) }).promise;
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return promise;
}

/** Page count of an uploaded file, validating that it is a readable PDF. */
export async function readPdfPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pages = doc.numPages;
  await doc.destroy();
  return pages;
}

/** Render every page of a PDF to a PNG data URL about `width` CSS pixels wide, for previews. */
export async function renderThumbnails(bytes: Uint8Array, width = 260): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const out: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width * ratio) / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      await page.render({ canvasContext: ctx, viewport }).promise;
      out.push(canvas.toDataURL('image/png'));
    }
  } finally {
    await doc.destroy();
  }
  return out;
}

/** Text runs on a page, centred, in page points from the top-left (the markup coordinate system). */
export async function extractPageText(page: PDFPageProxy): Promise<DrawingText[]> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const out: DrawingText[] = [];
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const [, , , , x, y] = pdfjs.Util.transform(viewport.transform, item.transform) as number[];
    const height = Math.hypot(item.transform[2], item.transform[3]);
    out.push({ str: item.str, x: x + item.width / 2, y: y - height / 2, width: item.width, height });
  }
  return out;
}

/** The page's linework as straight segments in page points from the top-left, for snapping markups onto lines. */
export async function extractPageSegments(page: PDFPageProxy): Promise<Segment[]> {
  const viewport = page.getViewport({ scale: 1 });
  const list = await page.getOperatorList();
  return segmentsFromOperatorList(list.fnArray, list.argsArray, pdfjs.OPS as unknown as PathOps, viewport.transform as Matrix);
}

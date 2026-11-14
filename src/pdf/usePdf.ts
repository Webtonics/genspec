import { useEffect, useState } from 'react';
import type { DrawingText } from '@/markup/drawingText';
import type { Drawing } from '@/model/types';
import { type PDFDocumentProxy, type PDFPageProxy, drawingKey, extractPageText, loadPdf } from './pdf';

type DocState = { key?: string; doc?: PDFDocumentProxy; error?: string };

/** Load (once per session) the PDF behind a drawing. */
export function usePdfDocument(drawing: Drawing | undefined): { doc?: PDFDocumentProxy; error?: string } {
  const key = drawing ? drawingKey(drawing) : undefined;
  const [state, setState] = useState<DocState>({});

  useEffect(() => {
    if (!drawing || !key) return;
    let cancelled = false;
    loadPdf(drawing).then(
      (doc) => !cancelled && setState({ key, doc }),
      (err: unknown) => !cancelled && setState({ key, error: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      cancelled = true;
    };
    // The key fingerprints the drawing, so a new drawing object with the same PDF does not reload.
  }, [key]);

  return state.key === key ? state : {};
}

export type PageSize = { width: number; height: number };

type PageState = { doc?: PDFDocumentProxy; pageNumber?: number; page?: PDFPageProxy; size?: PageSize; texts: DrawingText[] };

/** One page of a loaded PDF with its size in points and its text runs. */
export function usePdfPage(doc: PDFDocumentProxy | undefined, pageNumber: number) {
  const [state, setState] = useState<PageState>({ texts: [] });

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(Math.min(Math.max(pageNumber, 1), doc.numPages));
      const viewport = page.getViewport({ scale: 1 });
      const texts = await extractPageText(page).catch(() => []);
      if (!cancelled) {
        setState({ doc, pageNumber, page, size: { width: viewport.width, height: viewport.height }, texts });
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  return state.doc === doc && state.pageNumber === pageNumber ? state : { texts: [] as DrawingText[] };
}

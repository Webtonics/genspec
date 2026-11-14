import type { Drawing } from '@/model/types';
import { bytesToBase64, readPdfPageCount } from './pdf';

/** Drawings are kept in browser storage for this prototype, which allows about 5 MB in total. */
export const MAX_DRAWING_BYTES = 3 * 1024 * 1024;

export async function readDrawingFile(file: File): Promise<Drawing> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new Error('Choose a PDF file.');
  if (file.size > MAX_DRAWING_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`This PDF is ${mb} MB. The prototype stores drawings in the browser, so the limit is 3 MB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let pageCount: number;
  try {
    pageCount = await readPdfPageCount(bytes);
  } catch {
    throw new Error('This file could not be read as a PDF.');
  }
  return { fileName: file.name, pdfBase64: bytesToBase64(bytes), pageCount };
}

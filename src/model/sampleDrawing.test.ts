import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { DEMO_JOB_IDS, makeDemoJobs, makeSampleDrawing } from './seed';

const A3_LANDSCAPE = { width: (420 * 72) / 25.4, height: (297 * 72) / 25.4 };

describe('sample P&ID', () => {
  it('is a valid one page A3 landscape PDF', async () => {
    const drawing = makeSampleDrawing();
    const pdf = await PDFDocument.load(drawing.pdfBase64);
    expect(pdf.getPageCount()).toBe(1);
    expect(drawing.pageCount).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(A3_LANDSCAPE.width, 1);
    expect(height).toBeCloseTo(A3_LANDSCAPE.height, 1);
  });

  it('carries the client drawing number in its metadata and file name', async () => {
    const drawing = makeSampleDrawing();
    const pdf = await PDFDocument.load(drawing.pdfBase64, { updateMetadata: false });
    expect(pdf.getTitle()).toContain('DEC-EXP-PID-2001');
    expect(drawing.fileName).toBe('DEC-EXP-PID-2001_Rev0.pdf');
  });

  it('is attached to the demo hydrotest job only', () => {
    const [hydro, n2] = makeDemoJobs();
    expect(hydro.id).toBe(DEMO_JOB_IDS.hydrotest);
    expect(hydro.drawing?.pdfBase64).toBe(makeSampleDrawing().pdfBase64);
    expect(n2.drawing).toBeUndefined();
  });
});

import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createMarkup } from '@/markup/ops';
import { makeDemoJobs } from '@/model/seed';
import type { Job, Markup, MarkupType, Point, ValvePosition } from '@/model/types';
import { makeDefaultRules } from '@/rules';
import { DEFAULT_TITLE_BLOCK } from '@/rules/titleBlock';
import { type TestPack, buildTestPack } from './buildTestPack';
import { winAnsi } from './pdfKit';

beforeAll(async () => {
  // Run the pdfjs worker on the main thread so text can be extracted in Node.
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
});

const GENERATED = new Date('2026-11-13T09:00:00Z');

function markedUpJob(): Job {
  const job = makeDemoJobs()[0];
  let markups: Markup[] = [];
  const add = (type: MarkupType, points: Point[], extra: { tag?: string; valvePosition?: ValvePosition } = {}) => {
    markups = createMarkup(markups, { type, page: 1, points, sectionId: 'demo-sec-tp012', ...extra }).markups;
  };
  add('boundary', [
    { x: 395, y: 288 },
    { x: 925, y: 288 },
    { x: 925, y: 432 },
    { x: 395, y: 432 },
  ]);
  add('blind', [{ x: 430, y: 360 }]);
  add('blind', [{ x: 893, y: 360 }]);
  add('valve', [{ x: 410, y: 360 }], { tag: 'MV-101' });
  add('vent', [{ x: 640, y: 360 }]);
  add('gauge', [{ x: 528, y: 360 }]);
  add('purgeRoute', [
    { x: 175, y: 200 },
    { x: 490, y: 200 },
    { x: 490, y: 360 },
  ]);
  return { ...job, markups };
}

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, verbosity: 0 }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    out.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  await doc.destroy();
  return out;
}

const build = (job: Job) =>
  buildTestPack({ job, rules: makeDefaultRules(), listFields: {}, titleBlock: DEFAULT_TITLE_BLOCK, generatedAt: GENERATED });

describe('test pack FOR REVIEW', () => {
  let pack: TestPack;
  let texts: string[];
  const job = markedUpJob();

  beforeAll(async () => {
    pack = await build(job);
    texts = await pageTexts(pack.bytes);
  });

  it('has the cover, drawing, calculations, five lists and sign-off in order', () => {
    expect(pack.parts.map((p) => [p.title, p.firstPage, p.pageCount])).toEqual([
      ['Cover sheet', 1, 1],
      ['Marked-up test limit diagram', 2, 1],
      ['Test section calculations', 3, 2],
      ['Blind list', 5, 1],
      ['Vent and drain list', 6, 1],
      ['Valve line-up', 7, 1],
      ['Joint register', 8, 1],
      ['Gauge and recorder list', 9, 1],
      ['Sign-off sheet', 10, 1],
    ]);
    expect(pack.pageCount).toBe(10);
    expect(pack.fileName).toBe('GPPSL-26-0412-TP-01_Test-pack_RevA_FOR-REVIEW.pdf');
  });

  it('keeps the client drawing at its own size with a GenSpec band added below', async () => {
    const pdf = await PDFDocument.load(pack.bytes);
    const drawing = pdf.getPage(1).getSize();
    expect(drawing.width).toBeCloseTo(1190.55, 1);
    expect(drawing.height).toBeCloseTo(841.89 + 150, 1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 841.89, height: 595.28 });
  });

  it('puts FOR REVIEW and the page number in every title block', () => {
    texts.forEach((t, i) => {
      expect(t).toContain('FOR REVIEW');
      expect(t).toContain(`${i + 1} of 10`);
      expect(t).toContain('GPPSL-26-0412-TP-01');
    });
  });

  it('draws the markups over the unaltered client drawing', () => {
    const drawing = texts[1];
    expect(drawing).toContain('DEC-EXP-PID-2001'); // the client's own title block, embedded
    for (const tag of ['TL-1 · TP-012', 'B1', 'B2', 'MV-101', 'CLOSED', 'V1', 'PRG-1', 'PI']) expect(drawing).toContain(tag);
    expect(drawing).toContain('GENSPEC MARKUP LAYER');
  });

  it('prints the calculations with their working and flag', () => {
    expect(texts[2]).toContain('Test section calculations: TP-012');
    expect(texts[2]).toContain('AMBER');
    expect(texts[2]).toContain('127.87 barg');
    expect(texts[2]).toContain('pi/4');
    expect(texts[3]).toContain('TP-013');
    expect(texts[3]).toContain('GREEN');
  });

  it('prints the lists as tables', () => {
    expect(texts[4]).toContain('Blind list');
    expect(texts[4]).toMatch(/B1.*TP-012.*Spectacle blind/);
    expect(texts[6]).toMatch(/MV-101.*Valve.*Closed/);
    expect(texts[8]).toMatch(/PI-101.*Gauge.*123.75 to 127.87/);
  });

  it('lists the contents with page numbers on the cover', () => {
    expect(texts[0]).toContain('PRESSURE TEST PACK');
    expect(texts[0]).toMatch(/Test section calculations\s+3 to 4/);
    expect(texts[0]).toMatch(/Sign-off sheet\s+10/);
  });
});

describe('test pack after approval', () => {
  it('drops the watermark and stamps the engineer and date everywhere', async () => {
    const job: Job = { ...markedUpJob(), status: 'APPROVED', approvedBy: 'A. Okafor', approvedAt: '2026-11-13T10:15:00.000Z' };
    const pack = await build(job);
    const texts = await pageTexts(pack.bytes);
    expect(pack.fileName).toContain('_APPROVED.pdf');
    texts.forEach((t) => {
      // The embedded client drawing has its own "ISSUED FOR REVIEW" revision row, which must stay.
      expect(t.replaceAll('ISSUED FOR REVIEW', '')).not.toContain('FOR REVIEW');
      expect(t).toContain('APPROVED');
      expect(t).toContain('A. Okafor, 13 Nov 2026');
    });
    expect(texts[0]).toContain('Approved by A. Okafor, 13 Nov 2026');
    expect(texts[9]).toMatch(/Approved by \(engineer\).*A\. Okafor.*Approved in GenSpec.*13 Nov 2026/);
  });
});

describe('test pack after a client comment', () => {
  it('shows the new revision, the revision note and the comment in the revision table', async () => {
    const base = markedUpJob();
    const b1 = base.markups.find((m) => m.tag === 'B1')!;
    const job: Job = {
      ...base,
      revision: 'B',
      history: [{ kind: 'comment', rev: 'B', at: '2026-11-12T16:00:00.000Z', text: 'Move B1 to the upstream flange of MV-101.', markupId: b1.id }],
    };
    const pack = await build(job);
    const texts = await pageTexts(pack.bytes);
    expect(pack.fileName).toContain('_RevB_');
    expect(texts[1]).toContain('REVISION NOTES');
    expect(texts[1]).toContain('Move B1 to the upstream flange of MV-101.');
    expect(texts[0]).toContain('Client comment: Move B1');
    expect(texts[0]).toContain('Revision B');
  });
});

describe('text encoding', () => {
  it('replaces characters the standard fonts cannot draw', () => {
    expect(winAnsi('V = π/4 × (ID ÷ 1000)² × L')).toBe('V = pi/4 × (ID ÷ 1000)² × L');
    expect(winAnsi('Δh ≈ 0')).toBe('dh ~ 0');
    expect(winAnsi('m³ and 65 °C')).toBe('m³ and 65 °C');
  });
});

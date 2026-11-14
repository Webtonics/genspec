/**
 * Builds the combined test pack PDF with pdf-lib:
 *
 *   cover sheet, marked-up test limit diagram (the client's page embedded
 *   unaltered with the markup layer drawn on top), test section calculations,
 *   the five lists as tables, sign-off sheet.
 *
 * Every page carries a title block with the job status, and a diagonal
 * FOR REVIEW watermark until an engineer approves the job.
 */
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { type JobCalc, type SectionCalc, calculateJob } from '@/calc';
import { HIGH_INDEX, LOW_INDEX, sketchPoints, smoothPath } from '@/calc/sketch';
import { fmtDate, fmtHours, fmtMinutes, fmtNumber, fmtValue } from '@/lib/format';
import { type FieldsByMarkup, buildLists, displayValue } from '@/lists/buildLists';
import { LIST_DEFS } from '@/lists/definitions';
import { MARKUP_TYPE_LABELS, MEDIUM_LABELS } from '@/model/options';
import { currentRevisionComments, revisionRows } from '@/model/revision';
import type { Job, MarkupType } from '@/model/types';
import { RULE_DEFAULT_LABEL, type RuleSet } from '@/rules';
import { type TitleBlockSettings, documentNumber } from '@/rules/titleBlock';
import { cloudMarkup, drawMarkups, haloText, revisionTriangle } from './markupPdf';
import { COLORS, Canvas, type Fonts, hex } from './pdfKit';
import { cloudPath } from '@/markup/geometry';

export type TestPackInput = {
  job: Job;
  rules: RuleSet;
  listFields: FieldsByMarkup;
  titleBlock: TitleBlockSettings;
  generatedAt: Date;
};

export type TestPackPart = { title: string; firstPage: number; pageCount: number };

export type TestPack = { bytes: Uint8Array; pageCount: number; parts: TestPackPart[]; docNo: string; fileName: string };

const A4: [number, number] = [841.89, 595.28];
const M = 28;
const TB_H = 50;
const BAND = 150;
const CONTENT_TOP = 46;
const CONTENT_BOTTOM = A4[1] - M - TB_H - 12;
const CONTENT_W = A4[0] - 2 * M;

type PageMeta = { title: string; drawingHeight?: number };

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const FLAG_STYLE = {
  RED: { color: COLORS.red, fill: COLORS.redFill },
  AMBER: { color: COLORS.amber, fill: COLORS.amberFill },
  GREEN: { color: COLORS.green, fill: COLORS.greenFill },
};

class PackBuilder {
  readonly doc: PDFDocument;
  readonly fonts: Fonts;
  readonly input: TestPackInput;
  readonly calc: JobCalc;
  readonly docNo: string;
  readonly approved: boolean;
  readonly metas: PageMeta[] = [];
  readonly parts: TestPackPart[] = [];
  private partStart = 0;
  private partTitle = '';

  constructor(doc: PDFDocument, fonts: Fonts, input: TestPackInput) {
    this.doc = doc;
    this.fonts = fonts;
    this.input = input;
    this.calc = calculateJob(input.job, input.rules);
    this.docNo = documentNumber(input.titleBlock.documentFormat, input.job.jobNo, 'TP', 1);
    this.approved = input.job.status === 'APPROVED';
  }

  get job() {
    return this.input.job;
  }

  startPart(title: string) {
    this.partTitle = title;
    this.partStart = this.doc.getPageCount();
  }

  endPart() {
    const count = this.doc.getPageCount() - this.partStart;
    if (count > 0) this.parts.push({ title: this.partTitle, firstPage: this.partStart + 1, pageCount: count });
  }

  /** A new A4 landscape page with its heading. Returns the canvas. */
  a4(title: string, heading?: string, subheading?: string): Canvas {
    const page = this.doc.addPage(A4);
    this.metas.push({ title });
    const cv = new Canvas(page, this.fonts);
    if (heading) {
      cv.text(heading, M, CONTENT_TOP, { size: 14, font: 'bold' });
      if (subheading) cv.text(subheading, M, CONTENT_TOP + 14, { size: 8.5, color: COLORS.muted, maxWidth: CONTENT_W });
    }
    return cv;
  }

  statusLines(): [string, string] {
    const j = this.job;
    if (this.approved) {
      return ['APPROVED', `${j.approvedBy ?? ''}${j.approvedAt ? `, ${fmtDate(j.approvedAt)}` : ''}`];
    }
    return ['FOR REVIEW', 'Not yet approved'];
  }

  // ------------------------------------------------------------------ title block and watermark

  titleBlock(cv: Canvas, x: number, y: number, w: number, title: string, pageNo: number, total: number) {
    const tb = this.input.titleBlock;
    const fr = [118, 236, 92, 116, 34, 134, 56];
    const scale = w / fr.reduce((a, b) => a + b, 0);
    const widths = fr.map((f) => f * scale);
    cv.rect(x, y, w, TB_H, { fill: COLORS.white, stroke: COLORS.ink, width: 1.2 });
    let cx = x;
    const cells: { label: string; value: string; sub?: string; color?: typeof COLORS.ink; big?: boolean }[] = [
      { label: '', value: tb.company, sub: tb.tagline, big: true },
      { label: 'DOCUMENT', value: title, sub: this.job.title },
      { label: 'JOB NO.', value: this.job.jobNo },
      { label: 'DOCUMENT NO.', value: this.docNo },
      { label: 'REV', value: this.job.revision },
      {
        label: 'STATUS',
        value: this.statusLines()[0],
        sub: this.statusLines()[1],
        color: this.approved ? COLORS.green : COLORS.amber,
      },
      { label: 'PAGE', value: `${pageNo} of ${total}` },
    ];
    cells.forEach((c, i) => {
      const cw = widths[i];
      if (i > 0) cv.line(cx, y, cx, y + TB_H, { color: COLORS.ink, width: 0.6 });
      if (c.big) {
        cv.text(c.value, cx + 8, y + 24, { size: 15, font: 'bold', maxWidth: cw - 14 });
        if (c.sub) cv.text(c.sub, cx + 8, y + 37, { size: 6.5, color: COLORS.muted, maxWidth: cw - 14 });
      } else {
        cv.text(c.label, cx + 6, y + 10, { size: 5.8, color: COLORS.muted });
        cv.text(c.value, cx + 6, y + 25, { size: 9.5, font: 'bold', color: c.color, maxWidth: cw - 10 });
        if (c.sub) cv.text(c.sub, cx + 6, y + 38, { size: 6.8, color: COLORS.muted, maxWidth: cw - 10 });
      }
      cx += cw;
    });
  }

  watermark(cv: Canvas, cx: number, cy: number, size: number) {
    if (this.approved) return;
    const text = 'FOR REVIEW';
    const font = this.fonts.bold;
    const w = font.widthOfTextAtSize(text, size);
    const a = (30 * Math.PI) / 180;
    const pdfCx = cx;
    const pdfCy = cv.height - cy;
    cv.page.drawText(text, {
      x: pdfCx - (w / 2) * Math.cos(a) + size * 0.35 * Math.sin(a),
      y: pdfCy - (w / 2) * Math.sin(a) - size * 0.35 * Math.cos(a),
      size,
      font,
      color: COLORS.markup,
      opacity: 0.09,
      rotate: degrees(30),
    });
  }

  finish() {
    const pages = this.doc.getPages();
    const total = pages.length;
    pages.forEach((page, i) => {
      const cv = new Canvas(page, this.fonts);
      const meta = this.metas[i];
      if (meta.drawingHeight !== undefined) {
        this.watermark(cv, cv.width / 2, meta.drawingHeight / 2, Math.min(cv.width, meta.drawingHeight) * 0.16);
        this.titleBlock(cv, 20, meta.drawingHeight + 90, cv.width - 40, meta.title, i + 1, total);
      } else {
        this.watermark(cv, cv.width / 2, (CONTENT_TOP + CONTENT_BOTTOM) / 2, 96);
        cv.rect(M - 8, M - 8, cv.width - 2 * (M - 8), cv.height - 2 * (M - 8), { stroke: COLORS.ink, width: 0.8 });
        this.titleBlock(cv, M, cv.height - M - TB_H, CONTENT_W, meta.title, i + 1, total);
      }
    });
  }

  // ------------------------------------------------------------------ tables

  /**
   * Draw a table, wrapping cell text (up to 3 lines) and continuing on new pages
   * with the header repeated. Returns the canvas and y after the table.
   */
  table(
    start: { cv: Canvas; y: number },
    columns: { header: string; width: number; align?: 'left' | 'center' | 'right'; mono?: boolean; bold?: boolean }[],
    rows: { cells: string[]; colors?: (typeof COLORS.ink | undefined)[]; fills?: (typeof COLORS.ink | undefined)[] }[],
    continuePage: () => Canvas,
    size = 7.5,
    minRowHeight = 0,
  ): { cv: Canvas; y: number } {
    let { cv, y } = start;
    const total = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * CONTENT_W);
    const lineH = size + 2.6;

    const header = () => {
      const lines = columns.map((c, i) => cv.wrap(c.header, widths[i] - 8, size, 'bold').slice(0, 2));
      const h = Math.max(...lines.map((l) => l.length)) * lineH + 8;
      cv.rect(M, y, CONTENT_W, h, { fill: COLORS.dark });
      let x = M;
      lines.forEach((ls, i) => {
        ls.forEach((l, k) => {
          const align = columns[i].align ?? 'left';
          const tx = align === 'center' ? x + widths[i] / 2 : align === 'right' ? x + widths[i] - 4 : x + 4;
          cv.text(l, tx, y + 4 + size + k * lineH, { size, font: 'bold', color: COLORS.white, align });
        });
        x += widths[i];
      });
      y += h;
    };

    header();
    rows.forEach((row, r) => {
      const fontOf = (c: (typeof columns)[number]) => (c.mono ? (c.bold ? 'monoBold' : 'mono') : c.bold ? 'bold' : 'regular');
      const lines = row.cells.map((cell, i) => {
        const font = fontOf(columns[i]);
        const wrapped = cv.wrap(cell, widths[i] - 8, size, font);
        return wrapped.length > 3 ? [...wrapped.slice(0, 2), cv.fit(wrapped.slice(2).join(' '), widths[i] - 8, size, font)] : wrapped;
      });
      const h = Math.max(minRowHeight, Math.max(...lines.map((l) => l.length)) * lineH + 6);
      if (y + h > CONTENT_BOTTOM) {
        cv = continuePage();
        y = CONTENT_TOP + 26;
        header();
      }
      if (r % 2 === 1) cv.rect(M, y, CONTENT_W, h, { fill: COLORS.zebra });
      let x = M;
      lines.forEach((ls, i) => {
        if (row.fills?.[i]) cv.rect(x + 1, y + 1, widths[i] - 2, h - 2, { fill: row.fills[i] });
        const c = columns[i];
        const font = fontOf(c);
        ls.forEach((l, k) => {
          const align = c.align ?? 'left';
          const tx = align === 'center' ? x + widths[i] / 2 : align === 'right' ? x + widths[i] - 4 : x + 4;
          cv.text(l, tx, y + 3 + size + k * lineH, { size, font, color: row.colors?.[i] ?? COLORS.ink, align });
        });
        x += widths[i];
      });
      cv.line(M, y + h, M + CONTENT_W, y + h, { color: COLORS.line, width: 0.5 });
      y += h;
    });
    cv.rect(M, start.y, CONTENT_W, 0.01, { stroke: COLORS.rule, width: 0.4 });
    return { cv, y };
  }

  // ------------------------------------------------------------------ cover

  cover(): { cv: Canvas; contentsY: number } {
    const { job } = this;
    const tb = this.input.titleBlock;
    const cv = this.a4('Cover sheet');

    cv.text(tb.company, M + 4, 62, { size: 30, font: 'bold' });
    cv.text(tb.tagline, M + 6, 76, { size: 9, color: COLORS.muted });

    // Status stamp
    const [status, sub] = this.statusLines();
    const stampColor = this.approved ? COLORS.green : COLORS.amber;
    cv.rect(A4[0] - M - 236, 34, 236, 66, { fill: this.approved ? COLORS.greenFill : COLORS.amberFill, stroke: stampColor, width: 2 });
    cv.text(status, A4[0] - M - 118, 64, { size: 22, font: 'bold', color: stampColor, align: 'center' });
    cv.text(this.approved ? `Approved by ${sub}` : 'Generated for engineering review', A4[0] - M - 118, 80, {
      size: 8.5,
      color: stampColor,
      align: 'center',
      maxWidth: 224,
    });
    cv.text(`Revision ${job.revision}`, A4[0] - M - 118, 92, { size: 8.5, font: 'bold', color: stampColor, align: 'center' });

    cv.text('PRESSURE TEST PACK', M + 4, 128, { size: 24, font: 'bold' });
    cv.text(job.title, M + 4, 148, { size: 14, maxWidth: CONTENT_W - 8 });
    cv.text(
      `Client: ${job.client || 'not set'}   ·   Job ${job.jobNo}   ·   Document ${this.docNo}   ·   ${MEDIUM_LABELS[job.medium]}, ${job.code}   ·   Generated ${fmtDate(this.input.generatedAt.toISOString())}`,
      M + 4,
      164,
      { size: 8.5, color: COLORS.muted, maxWidth: CONTENT_W - 8 },
    );

    // Test sections summary
    cv.text('TEST SECTIONS', M + 4, 186, { size: 8, font: 'bold', color: COLORS.muted });
    const rows = job.sections.map((s, i) => {
      const c = this.calc.sections[i];
      const v = c.values;
      const flag = c.flag?.flag;
      const num = (n: number | undefined, d: number) => (n === undefined ? 'n/a' : fmtNumber(n, d));
      return {
        cells: [
          s.name,
          `${fmtValue(s.nps)}" x ${fmtValue(s.wtMm)} mm WT`,
          fmtNumber(s.lengthM / 1000, 2),
          num(v.volumeM3, 1),
          num(v.highPointBarg, 2),
          num(v.lowPointBarg, 2),
          fmtNumber(s.maxAllowableTestBarg, 2),
          fmtHours(s.holdHours),
          flag ?? 'INCOMPLETE',
        ],
        colors: [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, flag ? FLAG_STYLE[flag].color : COLORS.muted],
        fills: [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, flag ? FLAG_STYLE[flag].fill : undefined],
      };
    });
    const after = this.table(
      { cv, y: 192 },
      [
        { header: 'Section', width: 9, bold: true },
        { header: 'Pipe', width: 15 },
        { header: 'Length (km)', width: 9, align: 'right' },
        { header: 'Volume (m³)', width: 10, align: 'right' },
        { header: 'Test at HP (barg)', width: 11, align: 'right' },
        { header: 'Test at LP (barg)', width: 11, align: 'right' },
        { header: 'Max allowable (barg)', width: 12, align: 'right' },
        { header: 'Hold', width: 8, align: 'center' },
        { header: 'Flag', width: 10, align: 'center' },
      ],
      rows,
      () => this.a4('Cover sheet (continued)'),
    );

    // Revision history, right half
    const revY = after.y + 22;
    const half = (CONTENT_W - 20) / 2;
    const rx = M + half + 20;
    cv.text('REVISIONS', rx, revY, { size: 8, font: 'bold', color: COLORS.muted });
    let ry = revY + 8;
    cv.rect(rx, ry, half, 16, { fill: COLORS.dark });
    const rcols = [30, 64, half - 30 - 64 - 80, 80];
    ['Rev', 'Date', 'Description', 'By'].forEach((h, i) => {
      cv.text(h, rx + rcols.slice(0, i).reduce((a, b) => a + b, 0) + 4, ry + 11, { size: 7.5, font: 'bold', color: COLORS.white });
    });
    ry += 16;
    for (const row of revisionRows(job, tb.company).slice(-8)) {
      const desc = cv.wrap(row.description, rcols[2] - 8, 7.5).slice(0, 2);
      const h = desc.length * 10 + 6;
      const current = row.rev === job.revision;
      if (current) cv.rect(rx, ry, half, h, { fill: COLORS.zebra });
      cv.text(row.rev, rx + 4, ry + 10, { size: 7.5, font: 'bold' });
      cv.text(row.at ? fmtDate(row.at) : '', rx + rcols[0] + 4, ry + 10, { size: 7.5 });
      desc.forEach((l, k) => cv.text(l, rx + rcols[0] + rcols[1] + 4, ry + 10 + k * 10, { size: 7.5 }));
      cv.text(row.by, rx + rcols[0] + rcols[1] + rcols[2] + 4, ry + 10, { size: 7.5, maxWidth: rcols[3] - 8 });
      cv.line(rx, ry + h, rx + half, ry + h, { color: COLORS.line, width: 0.5 });
      ry += h;
    }

    cv.text(
      `Engineering figures come from deterministic formulas and the rule tables. Values marked "${RULE_DEFAULT_LABEL}" in the app are shipped defaults.`,
      M + 4,
      CONTENT_BOTTOM - 4,
      { size: 7, color: COLORS.muted, maxWidth: CONTENT_W - 8 },
    );

    return { cv, contentsY: revY };
  }

  drawContents(cv: Canvas, y: number) {
    const half = (CONTENT_W - 20) / 2;
    cv.text('CONTENTS', M + 4, y, { size: 8, font: 'bold', color: COLORS.muted });
    let cy = y + 8;
    cv.rect(M, cy, half, 16, { fill: COLORS.dark });
    cv.text('No.', M + 4, cy + 11, { size: 7.5, font: 'bold', color: COLORS.white });
    cv.text('Document', M + 30, cy + 11, { size: 7.5, font: 'bold', color: COLORS.white });
    cv.text('Pages', M + half - 4, cy + 11, { size: 7.5, font: 'bold', color: COLORS.white, align: 'right' });
    cy += 16;
    this.parts.forEach((p, i) => {
      if (i % 2 === 1) cv.rect(M, cy, half, 14, { fill: COLORS.zebra });
      cv.text(String(i + 1), M + 4, cy + 10, { size: 7.5 });
      cv.text(p.title, M + 30, cy + 10, { size: 7.5 });
      cv.text(p.pageCount > 1 ? `${p.firstPage} to ${p.firstPage + p.pageCount - 1}` : String(p.firstPage), M + half - 4, cy + 10, {
        size: 7.5,
        align: 'right',
      });
      cy += 14;
    });
    cv.line(M, cy, M + half, cy, { color: COLORS.rule, width: 0.5 });
  }

  // ------------------------------------------------------------------ marked-up drawing

  async drawingPages() {
    const { job } = this;
    if (!job.drawing) {
      const cv = this.a4('Marked-up test limit diagram', 'Marked-up test limit diagram', 'No client drawing is attached to this job.');
      cv.text('Attach the client P&ID in the Markup studio and generate the pack again.', M, CONTENT_TOP + 40, { size: 10, color: COLORS.muted });
      return;
    }
    const bytes = base64ToBytes(job.drawing.pdfBase64);
    const source = await PDFDocument.load(bytes);
    const indices = source.getPageIndices();
    const embedded = await this.doc.embedPdf(bytes, indices);
    const sectionNames = new Map(job.sections.map((s) => [s.id, s.name]));
    const comments = currentRevisionComments(job);

    embedded.forEach((emb, i) => {
      const w = emb.width;
      const h = emb.height;
      const page = this.doc.addPage([w, h + BAND]);
      this.metas.push({ title: 'Marked-up test limit diagram', drawingHeight: h });
      page.drawPage(emb, { x: 0, y: BAND, width: w, height: h });
      const cv = new Canvas(page, this.fonts);
      const pageMarkups = job.markups.filter((m) => m.page === i + 1);
      drawMarkups(cv, pageMarkups, { x: 0, y: 0 }, sectionNames);
      for (const c of comments) {
        const m = pageMarkups.find((x) => x.id === c.markupId);
        if (m) cloudMarkup(cv, m, { x: 0, y: 0 }, c.rev);
      }
      this.drawingBand(cv, h, i + 1, indices.length, pageMarkups);
    });
  }

  drawingBand(cv: Canvas, top: number, pageNo: number, pageCount: number, pageMarkups: Job['markups']) {
    const { job } = this;
    cv.rect(0, top, cv.width, BAND, { fill: COLORS.white });
    cv.line(0, top, cv.width, top, { color: COLORS.ink, width: 1.2 });

    // Markup legend with counts
    const lx = 20;
    const ly = top + 8;
    const lw = Math.min(560, cv.width * 0.45);
    cv.rect(lx, ly, lw, 74, { stroke: COLORS.ink, width: 0.8 });
    cv.text('GENSPEC MARKUP LAYER', lx + 8, ly + 12, { size: 7.5, font: 'bold' });
    const counts = new Map<MarkupType, number>();
    for (const m of pageMarkups) counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
    const types = [...counts.keys()];
    if (types.length === 0) {
      cv.text('No markups on this page.', lx + 8, ly + 30, { size: 7.5, color: COLORS.muted });
    }
    types.forEach((t, k) => {
      const col = Math.floor(k / 4);
      const row = k % 4;
      const ex = lx + 8 + col * (lw / 3);
      const ey = ly + 26 + row * 11.5;
      cv.rect(ex, ey - 6, 8, 6, t === 'gauge' || t === 'recorder' ? { fill: COLORS.instrument } : { fill: COLORS.markup });
      cv.text(`${MARKUP_TYPE_LABELS[t]} (${counts.get(t)})`, ex + 12, ey, { size: 7, maxWidth: lw / 3 - 18 });
    });
    cv.text(
      `Client drawing ${job.drawing?.fileName ?? ''}, page ${pageNo} of ${pageCount}, reproduced unaltered. Markups overlaid by GenSpec.`,
      lx + 8,
      ly + 70,
      { size: 6.3, color: COLORS.muted, maxWidth: lw - 16 },
    );

    // Revision notes
    const nx = lx + lw + 12;
    const nw = cv.width - nx - 20;
    cv.rect(nx, ly, nw, 74, { stroke: COLORS.ink, width: 0.8 });
    cv.text('REVISION NOTES', nx + 8, ly + 12, { size: 7.5, font: 'bold' });
    const notes = (job.history ?? []).filter((e) => e.kind === 'comment').slice(-3).reverse();
    if (notes.length === 0) {
      cv.text(`Revision ${job.revision}: first issue for review. No client comments.`, nx + 8, ly + 30, { size: 7.5, color: COLORS.muted });
    }
    let ny = ly + 24;
    for (const n of notes) {
      if (n.kind !== 'comment') continue;
      const lines = cv.wrap(`${fmtDate(n.at)}: ${n.text}`, nw - 60, 7.5).slice(0, 2);
      const h = lines.length * 10 + 6;
      if (ny + h > ly + 72) break;
      revisionTriangle(cv, nx + 20, ny + h / 2, n.rev, 13);
      lines.forEach((l, k) => cv.text(l, nx + 36, ny + 9 + k * 10, { size: 7.5 }));
      if (n.rev === job.revision) {
        const pts = [
          { x: nx + 6, y: ny - 2 },
          { x: nx + nw - 8, y: ny - 2 },
          { x: nx + nw - 8, y: ny + h },
          { x: nx + 6, y: ny + h },
        ];
        cv.path(cloudPath(pts, true, 8), 0, 0, { stroke: COLORS.markup, width: 1.1 });
      }
      ny += h + 4;
    }
  }

  // ------------------------------------------------------------------ calculations

  calculationPages() {
    const { job } = this;
    if (job.sections.length === 0) {
      const cv = this.a4('Test section calculations', 'Test section calculations', 'No test sections in this job.');
      cv.text('Add test sections in Job setup.', M, CONTENT_TOP + 40, { size: 10, color: COLORS.muted });
      return;
    }
    job.sections.forEach((s, i) => this.calculationPage(s, this.calc.sections[i]));
  }

  calculationPage(section: Job['sections'][number], calc: SectionCalc) {
    const { job } = this;
    const heading = `Test section calculations: ${section.name}`;
    let cv = this.a4(
      'Test section calculations',
      heading,
      `NPS ${fmtValue(section.nps)} · ${fmtNumber(section.lengthM / 1000, 2)} km · design ${fmtValue(section.designPressureBarg)} barg · ${job.code} · ${MEDIUM_LABELS[job.medium]}`,
    );
    const firstPage = cv;
    let y = CONTENT_TOP + 26;

    // Flag banner
    if (calc.flag) {
      const style = FLAG_STYLE[calc.flag.flag];
      cv.rect(M, y, CONTENT_W, 20, { fill: style.fill });
      cv.rect(M, y, 3, 20, { fill: style.color });
      cv.text(calc.flag.flag, M + 10, y + 13.5, { size: 9, font: 'bold', color: style.color });
      cv.text(calc.flag.message, M + 60, y + 13.5, { size: 8.5, color: style.color, maxWidth: CONTENT_W - 70 });
    } else {
      cv.rect(M, y, CONTENT_W, 20, { fill: COLORS.zebra });
      cv.text(`INCOMPLETE: ${calc.issues.join(' ')}`, M + 10, y + 13.5, { size: 8.5, color: COLORS.muted, maxWidth: CONTENT_W - 20 });
    }
    y += 32;

    // Working, left column
    const lw = 500;
    const startY = y;
    const colLabel = 128;
    const colFormula = 262;
    for (const group of calc.groups) {
      if (y + 40 > CONTENT_BOTTOM) {
        cv = this.a4('Test section calculations', `${heading} (continued)`);
        y = CONTENT_TOP + 26;
      }
      cv.text(group.title.toUpperCase(), M, y + 8, { size: 7.5, font: 'bold', color: COLORS.muted });
      y += 11;
      for (const step of group.steps) {
        const label = cv.wrap(step.label, colLabel - 6, 7.8, 'bold').slice(0, 2);
        const h = Math.max(21, label.length * 9.5 + 5) + (step.note ? 8 : 0);
        if (y + h > CONTENT_BOTTOM) {
          cv = this.a4('Test section calculations', `${heading} (continued)`);
          y = CONTENT_TOP + 26;
        }
        label.forEach((l, k) => cv.text(l, M + 4, y + 10 + k * 9.5, { size: 7.8, font: 'bold' }));
        cv.text(step.formula, M + colLabel, y + 9.5, { size: 7.2, font: 'mono', maxWidth: colFormula });
        cv.text(`= ${step.substitution}`, M + colLabel, y + 18.5, { size: 7.2, font: 'mono', color: COLORS.muted, maxWidth: colFormula });
        if (step.note) cv.text(step.note, M + colLabel, y + 26.5, { size: 6.4, color: COLORS.muted, maxWidth: colFormula + 100 });
        cv.text(`${fmtNumber(step.value, step.decimals)} ${step.unit}`, M + lw - 4, y + 13, { size: 9, font: 'bold', align: 'right' });
        cv.line(M, y + h, M + lw, y + h, { color: COLORS.line, width: 0.5 });
        y += h;
      }
      y += 4;
    }

    // Inputs and sketch in the right column of the section's first page.
    this.inputsAndSketch(firstPage, M + lw + 20, startY, CONTENT_W - lw - 20, section, calc);
  }

  inputsAndSketch(cv: Canvas, x: number, y: number, w: number, section: Job['sections'][number], calc: SectionCalc) {
    cv.text('INPUTS', x, y + 8, { size: 7.5, font: 'bold', color: COLORS.muted });
    let iy = y + 14;
    for (const input of calc.inputs) {
      const value =
        input.value === null ? (input.key === 'minHold' ? 'Per client' : 'Not set') : input.key === 'minHold' ? fmtMinutes(input.value) : `${fmtValue(input.value)} ${input.unit}`;
      const source = input.source === 'section' ? 'Job setup' : input.source === 'job' ? 'This job' : input.ruleDefault ? 'Default, confirm' : 'Settings';
      cv.text(input.label, x, iy + 8, { size: 6.8, maxWidth: w - 120 });
      cv.text(value, x + w - 62, iy + 8, { size: 6.8, font: 'bold', align: 'right' });
      cv.text(source, x + w, iy + 8, { size: 5.8, color: COLORS.muted, align: 'right' });
      cv.line(x, iy + 11.5, x + w, iy + 11.5, { color: COLORS.line, width: 0.4 });
      iy += 11.5;
    }

    if (calc.hold) {
      iy += 6;
      for (const line of cv.wrap(`Hold: ${calc.hold.message}`, w, 7.2)) {
        cv.text(line, x, iy + 8, { size: 7.2, color: calc.hold.ok === false ? COLORS.amber : COLORS.ink });
        iy += 9.5;
      }
    }

    // Elevation sketch
    const sy = iy + 10;
    const sh = Math.min(140, CONTENT_BOTTOM - sy);
    if (sh < 90 || !(section.highPointElevM >= section.lowPointElevM)) return;
    cv.rect(x, sy, w, sh, { stroke: COLORS.line, width: 0.8 });
    cv.text('ELEVATION SKETCH, NOT TO SCALE', x + 6, sy + 10, { size: 6, color: COLORS.muted });
    const pts = sketchPoints(x + 12, x + w - 70, sy + 38, sy + sh - 22);
    const profile = smoothPath(pts);
    cv.path(`${profile} L ${x + w - 70} ${sy + sh - 4} L ${x + 12} ${sy + sh - 4} Z`, 0, 0, { fill: hex('#E5E7EB') });
    cv.path(profile, 0, 0, { stroke: COLORS.ink, width: 2 });
    const [hx, hy] = pts[HIGH_INDEX];
    const [lx, ly] = pts[LOW_INDEX];
    const v = calc.values;
    cv.circle(hx, hy, 3.2, { fill: COLORS.white, stroke: COLORS.instrument, width: 1.4 });
    cv.circle(lx, ly, 3.2, { fill: COLORS.white, stroke: COLORS.instrument, width: 1.4 });
    haloText(cv, `HP EL ${fmtValue(section.highPointElevM)} m`, hx, hy - 16, 6.5, COLORS.ink, 'middle');
    haloText(cv, v.highPointBarg !== undefined ? `${fmtNumber(v.highPointBarg, 2)} barg` : 'n/a', hx, hy - 7, 7, COLORS.instrument, 'middle');
    const lowColor = calc.flag ? FLAG_STYLE[calc.flag.flag].color : COLORS.ink;
    haloText(cv, `LP EL ${fmtValue(section.lowPointElevM)} m`, lx, ly + 11, 6.5, COLORS.ink, 'middle');
    haloText(cv, v.lowPointBarg !== undefined ? `${fmtNumber(v.lowPointBarg, 2)} barg` : 'n/a', lx, ly + 20, 7, lowColor, 'middle');
    const dx = x + w - 34;
    cv.line(hx + 6, hy, dx + 4, hy, { color: COLORS.instrument, width: 0.6, dash: [2, 2] });
    cv.line(lx + 6, ly, dx + 4, ly, { color: COLORS.instrument, width: 0.6, dash: [2, 2] });
    cv.line(dx, hy, dx, ly, { color: COLORS.instrument, width: 1 });
    cv.text(`${fmtNumber(section.highPointElevM - section.lowPointElevM, 1)} m`, dx + 4, (hy + ly) / 2 - 2, { size: 6.5, font: 'bold' });
    if (v.staticHeadBar !== undefined) {
      cv.text(`${fmtNumber(v.staticHeadBar, 2)} bar`, dx + 4, (hy + ly) / 2 + 7, { size: 6.5, color: COLORS.instrument });
    }
  }

  // ------------------------------------------------------------------ lists

  listPages() {
    const { job } = this;
    const lists = buildLists(job, this.input.listFields, this.calc, this.input.generatedAt);
    for (const def of LIST_DEFS) {
      this.startPart(def.title);
      const rows = lists[def.key];
      const cv = this.a4(def.title, def.title, `${def.description} ${rows.length} ${rows.length === 1 ? 'item' : 'items'}.`);
      if (rows.length === 0) {
        cv.text(`${def.empty} Place them in the Markup studio and generate the pack again.`, M, CONTENT_TOP + 40, { size: 9, color: COLORS.muted });
        this.endPart();
        continue;
      }
      const tone = { red: COLORS.red, amber: COLORS.amber, green: COLORS.green, muted: COLORS.muted };
      const toneFill = { red: COLORS.redFill, amber: COLORS.amberFill, green: COLORS.greenFill, muted: undefined };
      this.table(
        { cv, y: CONTENT_TOP + 28 },
        def.columns.map((c) => ({
          header: c.header,
          width: c.width,
          align: c.align === 'center' || c.kind === 'index' ? ('center' as const) : ('left' as const),
          mono: c.kind === 'tag',
          bold: c.kind === 'tag',
        })),
        rows.map((row) => ({
          cells: def.columns.map((c) => displayValue(c, row, job)),
          colors: def.columns.map((c) => (row.tones[c.key] ? tone[row.tones[c.key]] : undefined)),
          fills: def.columns.map((c) => (row.tones[c.key] ? toneFill[row.tones[c.key]] : undefined)),
        })),
        () => this.a4(def.title, `${def.title} (continued)`),
      );
      this.endPart();
    }
  }

  // ------------------------------------------------------------------ sign-off

  signOffPage() {
    const { job } = this;
    const tb = this.input.titleBlock;
    let cv = this.a4('Sign-off sheet', 'Sign-off sheet', 'Complete during the test. The pack is not valid for the field until it is approved.');

    let state = this.table(
      { cv, y: CONTENT_TOP + 28 },
      [
        { header: 'Section', width: 9, bold: true },
        { header: 'Min test pressure at HP (barg)', width: 14, align: 'right' },
        { header: 'Hold', width: 7, align: 'center' },
        { header: 'Start (date, time)', width: 14 },
        { header: 'End (date, time)', width: 14 },
        { header: 'Pressure start (barg)', width: 12 },
        { header: 'Pressure end (barg)', width: 12 },
        { header: 'Result (accept or reject)', width: 13 },
      ],
      job.sections.map((s, i) => ({
        cells: [
          s.name,
          this.calc.sections[i].values.highPointBarg !== undefined ? fmtNumber(this.calc.sections[i].values.highPointBarg ?? 0, 2) : 'n/a',
          fmtHours(s.holdHours),
          '',
          '',
          '',
          '',
          '',
        ],
      })),
      () => this.a4('Sign-off sheet', 'Sign-off sheet (continued)'),
    );
    cv = state.cv;
    let y = state.y + 18;

    cv.text('PRE-TEST CHECKS', M, y, { size: 8, font: 'bold', color: COLORS.muted });
    y += 8;
    const checks = [
      'Test limits, blinds and spades installed as shown on the marked-up drawing and blind list.',
      'Valve line-up set and verified for the test stage.',
      'Gauges and recorders installed with valid calibration certificates (see gauge and recorder list).',
      'Joints broken for the test made up and recorded in the joint register.',
      'Relief valve set and fitted at the test head; test pump isolated for the hold.',
      'Line vented of air at the high points before pressurising.',
      'Line depressurised, drained and handed back after the test.',
    ];
    for (const c of checks) {
      cv.rect(M + 2, y + 3, 9, 9, { stroke: COLORS.ink, width: 0.8 });
      cv.text(c, M + 18, y + 11, { size: 8, maxWidth: CONTENT_W - 120 });
      cv.line(CONTENT_W + M - 80, y + 12, CONTENT_W + M, y + 12, { color: COLORS.line, width: 0.6 });
      y += 15;
    }
    cv.text('Initials', CONTENT_W + M - 40, y + 2, { size: 6.5, color: COLORS.muted, align: 'center' });
    y += 12;

    const approvedDate = job.approvedAt ? fmtDate(job.approvedAt) : '';
    this.table(
      { cv, y },
      [
        { header: 'Role', width: 16, bold: true },
        { header: 'Company', width: 14 },
        { header: 'Name', width: 18 },
        { header: 'Signature', width: 22 },
        { header: 'Date', width: 12 },
      ],
      [
        { cells: ['Prepared by', tb.company, '', '', ''] },
        { cells: ['Checked by', tb.company, '', '', ''] },
        {
          cells: ['Approved by (engineer)', tb.company, this.approved ? (job.approvedBy ?? '') : '', this.approved ? 'Approved in GenSpec' : '', this.approved ? approvedDate : ''],
          colors: [undefined, undefined, this.approved ? COLORS.green : undefined, this.approved ? COLORS.green : undefined, undefined],
        },
        { cells: ['Client representative', job.client || 'Client', '', '', ''] },
        { cells: ['Third-party witness', '', '', '', ''] },
      ],
      () => this.a4('Sign-off sheet', 'Sign-off sheet (continued)'),
      8.5,
      28,
    );
  }
}

export async function buildTestPack(input: TestPackInput): Promise<TestPack> {
  const doc = await PDFDocument.create();
  const { job, titleBlock, generatedAt } = input;
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
    monoBold: await doc.embedFont(StandardFonts.CourierBold),
  };
  const b = new PackBuilder(doc, fonts, input);

  b.startPart('Cover sheet');
  const cover = b.cover();
  b.endPart();

  b.startPart('Marked-up test limit diagram');
  await b.drawingPages();
  b.endPart();

  b.startPart('Test section calculations');
  b.calculationPages();
  b.endPart();

  b.listPages();

  b.startPart('Sign-off sheet');
  b.signOffPage();
  b.endPart();

  b.drawContents(cover.cv, cover.contentsY);
  b.finish();

  const status = job.status === 'APPROVED' ? 'APPROVED' : 'FOR REVIEW';
  doc.setTitle(`${b.docNo} Pressure test pack, ${job.jobNo} Rev ${job.revision} (${status})`);
  doc.setSubject(job.title);
  doc.setAuthor(titleBlock.company);
  doc.setCreator('GenSpec');
  doc.setProducer('GenSpec');
  doc.setCreationDate(generatedAt);
  doc.setModificationDate(generatedAt);

  const bytes = await doc.save();
  return {
    bytes,
    pageCount: doc.getPageCount(),
    parts: b.parts,
    docNo: b.docNo,
    fileName: `${b.docNo}_Test-pack_Rev${job.revision}_${status.replace(' ', '-')}.pdf`.replace(/[^\w.-]+/g, '_'),
  };
}

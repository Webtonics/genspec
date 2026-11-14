/**
 * Excel export of the lists: one sheet per list with GPPSL title rows, a styled
 * header row, borders, frozen panes, filters and dropdowns on the choice columns.
 * The builder is pure (pass in the exceljs Workbook class) so it can be tested
 * in Node; the browser loads exceljs only when someone exports.
 */
import type { Borders, Workbook, Worksheet } from 'exceljs';
import type { Job } from '@/model/types';
import { type ListKey, LIST_BY_KEY, type ListDef } from './definitions';
import { type Lists, type ListRow, type Tone, displayValue, parseDay } from './buildLists';

export type WorkbookCtor = new () => Workbook;

/** exceljs ships CommonJS (Node) and UMD (browser) builds, so the class may sit under default. */
export function workbookClass(mod: unknown): WorkbookCtor {
  const m = mod as { Workbook?: WorkbookCtor; default?: { Workbook?: WorkbookCtor } };
  const ctor = m.Workbook ?? m.default?.Workbook;
  if (!ctor) throw new Error('The spreadsheet library did not load.');
  return ctor;
}

export const HEADER_ROW = 5;
const INK = 'FF0B1220';
const MUTED = 'FF64748B';
const LINE = 'FFCBD5E1';
const ZEBRA = 'FFF8FAFC';

const TONE_STYLE: Record<Tone, { font: string; fill?: string }> = {
  red: { font: 'FFB91C1C', fill: 'FFFEE2E2' },
  amber: { font: 'FF92400E', fill: 'FFFEF3C7' },
  green: { font: 'FF047857', fill: 'FFD1FAE5' },
  muted: { font: MUTED },
};

const border = (color = LINE): Partial<Borders> => ({
  top: { style: 'thin', color: { argb: color } },
  left: { style: 'thin', color: { argb: color } },
  bottom: { style: 'thin', color: { argb: color } },
  right: { style: 'thin', color: { argb: color } },
});

const day = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function statusText(job: Job): string {
  if (job.status === 'APPROVED') {
    return `APPROVED${job.approvedBy ? ` by ${job.approvedBy}` : ''}${job.approvedAt ? ` on ${day(new Date(job.approvedAt))}` : ''}`;
  }
  return 'FOR REVIEW';
}

function addSheet(wb: Workbook, job: Job, def: ListDef, rows: ListRow[], generatedAt: Date): Worksheet {
  const cols = def.columns;
  const last = cols.length;
  const ws = wb.addWorksheet(def.sheetName, {
    views: [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: `&L${job.jobNo} Rev ${job.revision}&C${def.title}&RPage &P of &N` },
  });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));

  // Title rows
  ws.mergeCells(1, 1, 1, last);
  ws.mergeCells(2, 1, 2, last);
  ws.mergeCells(3, 1, 3, last);
  const title = ws.getCell(1, 1);
  title.value = { richText: [{ text: 'GPPSL  ', font: { bold: true, size: 16, color: { argb: INK } } }, { text: def.title, font: { bold: true, size: 14, color: { argb: INK } } }] };
  ws.getRow(1).height = 24;
  const jobLine = ws.getCell(2, 1);
  jobLine.value = `${job.jobNo}  ·  ${job.title}  ·  Client: ${job.client || 'not set'}`;
  jobLine.font = { size: 11, color: { argb: INK } };
  const statusLine = ws.getCell(3, 1);
  const approved = job.status === 'APPROVED';
  statusLine.value = {
    richText: [
      { text: `Revision ${job.revision}  ·  `, font: { size: 9, color: { argb: MUTED } } },
      { text: statusText(job), font: { size: 9, bold: true, color: { argb: approved ? 'FF047857' : 'FFB45309' } } },
      {
        text: `  ·  Generated ${day(generatedAt)} by GenSpec from the job markups. ${rows.length} ${rows.length === 1 ? 'item' : 'items'}.`,
        font: { size: 9, color: { argb: MUTED } },
      },
    ],
  };

  // Header row
  const header = ws.getRow(HEADER_ROW);
  header.height = 30;
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: c.align === 'center' ? 'center' : 'left', wrapText: true };
    cell.border = border('FF334155');
  });

  // Data rows
  rows.forEach((row, r) => {
    const xr = ws.getRow(HEADER_ROW + 1 + r);
    xr.height = 18;
    cols.forEach((c, i) => {
      const cell = xr.getCell(i + 1);
      const raw = row.values[c.key] ?? '';
      if (c.kind === 'index') cell.value = Number(raw);
      else if (c.kind === 'date' && parseDay(raw)) {
        const d = parseDay(raw) as Date;
        cell.value = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        cell.numFmt = 'dd mmm yyyy';
      } else cell.value = displayValue(c, row, job);

      const tone = row.tones[c.key];
      cell.font = {
        size: 10,
        bold: c.kind === 'tag',
        name: c.kind === 'tag' ? 'Consolas' : undefined,
        color: { argb: tone ? TONE_STYLE[tone].font : INK },
      };
      const fill = tone ? TONE_STYLE[tone].fill : r % 2 === 1 ? ZEBRA : undefined;
      if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.alignment = { vertical: 'middle', horizontal: c.align === 'center' ? 'center' : 'left', wrapText: c.key === 'notes' };
      cell.border = border();
      if (c.kind === 'select' && c.options) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${c.options.map((o) => o.label).join(',')}"`],
        };
      }
    });
  });

  if (rows.length === 0) {
    ws.mergeCells(HEADER_ROW + 1, 1, HEADER_ROW + 1, last);
    const cell = ws.getCell(HEADER_ROW + 1, 1);
    cell.value = `${def.empty} Place them in the Markup studio and export again.`;
    cell.font = { italic: true, size: 10, color: { argb: MUTED } };
  } else {
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: last } };
  }
  return ws;
}

/** A workbook with one sheet per requested list. */
export function buildListsWorkbook(Workbook: WorkbookCtor, job: Job, lists: Lists, keys: ListKey[], generatedAt: Date): Workbook {
  const wb = new Workbook();
  wb.creator = 'GenSpec';
  wb.company = 'GPPSL';
  wb.title = `${job.jobNo} ${keys.length === 1 ? LIST_BY_KEY[keys[0]].title : 'Pre-commissioning lists'}`;
  wb.created = generatedAt;
  wb.modified = generatedAt;
  for (const key of keys) addSheet(wb, job, LIST_BY_KEY[key], lists[key], generatedAt);
  return wb;
}

export function listsFileName(job: Job, keys: ListKey[]): string {
  const what = keys.length === 1 ? LIST_BY_KEY[keys[0]].fileSlug : 'Lists';
  return `${job.jobNo}_${what}_Rev${job.revision}.xlsx`.replace(/[^\w.-]+/g, '_');
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build and download the workbook in the browser. */
export async function downloadLists(job: Job, lists: Lists, keys: ListKey[]): Promise<void> {
  const Workbook = workbookClass(await import('exceljs'));
  const wb = buildListsWorkbook(Workbook, job, lists, keys, new Date());
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    listsFileName(job, keys),
  );
}

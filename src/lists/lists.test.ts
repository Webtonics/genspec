import * as excelModule from 'exceljs';
import { describe, expect, it } from 'vitest';
import { calculateJob } from '@/calc';
import { createMarkup, deleteMarkup } from '@/markup/ops';
import { makeDemoJobs } from '@/model/seed';
import type { Job, Markup, MarkupType, Point, ValvePosition } from '@/model/types';
import { makeDefaultRules } from '@/rules';
import { LIST_BY_KEY, LIST_KEYS } from './definitions';
import {
  type FieldsByMarkup,
  buildLists,
  calibrationStatus,
  displayValue,
  editTarget,
  storedValue,
} from './buildLists';
import { HEADER_ROW, buildListsWorkbook, listsFileName, workbookClass } from './exportXlsx';

const TODAY = new Date(2026, 10, 13); // 13 Nov 2026

function jobWithMarkups(): Job {
  const job = makeDemoJobs()[0];
  let markups: Markup[] = [];
  const add = (type: MarkupType, at: Point, extra: { tag?: string; valvePosition?: ValvePosition } = {}) => {
    markups = createMarkup(markups, { type, page: 1, points: [at], sectionId: 'demo-sec-tp012', ...extra }).markups;
  };
  add('blind', { x: 430, y: 360 });
  add('blind', { x: 893, y: 360 });
  add('drain', { x: 770, y: 360 });
  add('vent', { x: 640, y: 360 });
  add('fill', { x: 470, y: 360 });
  add('valve', { x: 410, y: 360 }, { tag: 'MV-101' });
  add('valve', { x: 410, y: 200 }, { tag: 'MV-103', valvePosition: 'open' });
  add('joint', { x: 380, y: 360 });
  add('gauge', { x: 528, y: 360 });
  add('recorder', { x: 600, y: 360 });
  return { ...job, markups };
}

const job = jobWithMarkups();
const calc = calculateJob(job, makeDefaultRules());
const lists = buildLists(job, {}, calc, TODAY);
const col = (list: keyof typeof LIST_BY_KEY, key: string) => LIST_BY_KEY[list].columns.find((c) => c.key === key)!;

describe('rows come from the markups', () => {
  it('one row per markup of the listed types, in list order', () => {
    expect(lists.blinds.map((r) => r.values.tag)).toEqual(['B1', 'B2']);
    expect(lists.ventsDrains.map((r) => r.values.tag)).toEqual(['V1', 'D1']);
    expect(lists.lineup.map((r) => r.values.tag)).toEqual(['MV-101', 'MV-103', 'F1', 'V1', 'D1']);
    expect(lists.joints.map((r) => r.values.tag)).toEqual(['J-001']);
    expect(lists.instruments.map((r) => r.values.tag)).toEqual(['PI-101', 'PR-101']);
  });

  it('numbers rows and renumbers live when a markup is deleted', () => {
    const b1 = job.markups.find((m) => m.tag === 'B1')!;
    const after = buildLists({ ...job, markups: deleteMarkup(job.markups, b1.id) }, {}, calc, TODAY);
    expect(after.blinds.map((r) => [r.values.no, r.values.tag])).toEqual([['1', 'B1']]);
  });

  it('defaults sizes from the test section and marks them as defaults', () => {
    expect(lists.blinds[0].values.size).toBe('12');
    expect(lists.blinds[0].defaulted.size).toBe(true);
    expect(lists.ventsDrains[0].values).toMatchObject({ size: '2', purpose: 'High point vent', kind: 'Vent' });
    expect(lists.ventsDrains[1].values.purpose).toBe('Low point drain');
  });

  it('uses fields entered on the lists over the defaults', () => {
    const b1 = job.markups.find((m) => m.tag === 'B1')!;
    const fields: FieldsByMarkup = { [b1.id]: { size: '14', rating: 'ASME 600' } };
    const row = buildLists(job, fields, calc, TODAY).blinds[0];
    expect(row.values).toMatchObject({ size: '14', rating: 'ASME 600' });
    expect(row.defaulted.size).toBe(false);
  });
});

describe('valve line-up', () => {
  it('takes the test position of valves from the drawing, and starts fill and drain the same', () => {
    const [mv101, mv103] = lists.lineup;
    expect(mv101.values).toMatchObject({ item: 'Valve', fill: 'closed', test: 'closed', drain: 'closed' });
    expect(mv103.values).toMatchObject({ fill: 'open', test: 'open', drain: 'open' });
  });

  it('vents open to fill and drain, drains open only to drain, fill points open only to fill', () => {
    const byTag = Object.fromEntries(lists.lineup.map((r) => [r.values.tag, r.values]));
    expect(byTag.V1).toMatchObject({ fill: 'open', test: 'closed', drain: 'open' });
    expect(byTag.D1).toMatchObject({ fill: 'closed', test: 'closed', drain: 'open' });
    expect(byTag.F1).toMatchObject({ fill: 'open', test: 'closed', drain: 'closed' });
  });

  it('shows positions with their labels', () => {
    expect(displayValue(col('lineup', 'test'), lists.lineup[1], job)).toBe('Open');
    expect(displayValue(col('lineup', 'section'), lists.lineup[0], job)).toBe('TP-012');
  });
});

describe('where edits go', () => {
  const valve = lists.lineup[0].markup;
  const vent = lists.lineup[3].markup;

  it('tag, section and notes edit the markup itself', () => {
    expect(editTarget('blinds', col('blinds', 'tag'), valve)).toEqual({ kind: 'markup', field: 'tag' });
    expect(editTarget('blinds', col('blinds', 'section'), valve)).toEqual({ kind: 'markup', field: 'sectionId' });
    expect(editTarget('blinds', col('blinds', 'notes'), valve)).toEqual({ kind: 'markup', field: 'notes' });
  });

  it("a valve's test position is its state on the drawing; a vent's is a list field", () => {
    expect(editTarget('lineup', col('lineup', 'test'), valve)).toEqual({ kind: 'markup', field: 'valvePosition' });
    expect(editTarget('lineup', col('lineup', 'test'), vent)).toEqual({ kind: 'list' });
  });

  it('derived columns are read only', () => {
    expect(editTarget('instruments', col('instruments', 'calStatus'), valve)).toBeNull();
  });

  it('entering the default value clears the override, so the default keeps following the job', () => {
    expect(storedValue(lists.blinds[0], 'size', '12')).toBeUndefined();
    expect(storedValue(lists.blinds[0], 'size', '14')).toBe('14');
    expect(storedValue(lists.blinds[0], 'rating', '  ')).toBeUndefined();
  });
});

describe('gauge and recorder list', () => {
  it('shows the section test pressure range from the calculations', () => {
    expect(lists.instruments[0].values.testPressure).toBe('123.75 to 127.87');
  });

  it('works out calibration status from the due date', () => {
    expect(calibrationStatus('', TODAY)).toEqual({ label: 'Not entered', tone: 'muted' });
    expect(calibrationStatus('2026-11-12', TODAY)).toEqual({ label: 'Expired', tone: 'red' });
    expect(calibrationStatus('2026-11-13', TODAY).tone).toBe('amber');
    expect(calibrationStatus('2026-12-13', TODAY).tone).toBe('amber');
    expect(calibrationStatus('2026-12-14', TODAY)).toEqual({ label: 'Valid', tone: 'green' });
  });
});

describe('Excel export', () => {
  const Workbook = workbookClass(excelModule);

  it('writes one sheet per list with GPPSL title rows and a styled header', async () => {
    const wb = buildListsWorkbook(Workbook, job, lists, LIST_KEYS, TODAY);
    const back = new Workbook();
    await back.xlsx.load(await wb.xlsx.writeBuffer());

    expect(back.worksheets.map((s) => s.name)).toEqual([
      'Blind list',
      'Vents and drains',
      'Valve line-up',
      'Joint register',
      'Gauges and recorders',
    ]);

    const ws = back.getWorksheet('Blind list')!;
    expect(ws.getCell('A1').text).toBe('GPPSL  Blind list');
    expect(ws.getCell('A2').text).toContain('GPPSL-26-0412');
    expect(ws.getCell('A3').text).toContain('FOR REVIEW');
    const header = ws.getRow(HEADER_ROW);
    expect(LIST_BY_KEY.blinds.columns.map((_, i) => header.getCell(i + 1).text)).toEqual(
      LIST_BY_KEY.blinds.columns.map((c) => c.header),
    );
    expect(header.getCell(1).fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FF0B1220' } });
    expect(ws.getRow(HEADER_ROW + 1).getCell(2).text).toBe('B1');
    expect(ws.getRow(HEADER_ROW + 1).getCell(3).text).toBe('TP-012');
    expect(ws.getRow(HEADER_ROW + 2).getCell(2).text).toBe('B2');
  });

  it('adds dropdowns to the line-up position columns', async () => {
    const wb = buildListsWorkbook(Workbook, job, lists, ['lineup'], TODAY);
    const ws = wb.getWorksheet('Valve line-up')!;
    const testCol = LIST_BY_KEY.lineup.columns.findIndex((c) => c.key === 'test') + 1;
    const cell = ws.getRow(HEADER_ROW + 1).getCell(testCol);
    expect(cell.text).toBe('Closed');
    expect(cell.dataValidation).toMatchObject({ type: 'list', formulae: ['"Open,Closed,Locked closed,Locked open"'] });
  });

  it('says so when a list is empty', () => {
    const empty = buildLists({ ...job, markups: [] }, {}, calc, TODAY);
    const ws = buildListsWorkbook(Workbook, job, empty, ['joints'], TODAY).getWorksheet('Joint register')!;
    expect(ws.getCell(HEADER_ROW + 1, 1).text).toContain('No joints marked up yet.');
  });

  it('names files after the job, list and revision', () => {
    expect(listsFileName(job, ['blinds'])).toBe('GPPSL-26-0412_Blind-list_RevA.xlsx');
    expect(listsFileName(job, LIST_KEYS)).toBe('GPPSL-26-0412_Lists_RevA.xlsx');
  });
});

import { describe, expect, it } from 'vitest';
import type { DrawingText } from '@/markup/drawingText';
import type { Segment } from '@/markup/lineSnap';
import { createMarkup } from '@/markup/ops';
import type { Markup } from '@/model/types';
import { acceptDrafts, aiDraftCount, planAutoMarkup, removeDrafts } from './autoMarkup';
import { suggestionViews } from './drawingRegister';
import type { DrawingRegister } from './types';

const t = (str: string, x: number, y: number, width = str.length * 4, height = 6): DrawingText => ({ str, x, y, width, height });

/** A pipe along y = 100 with a relief valve branch going up at x = 320. */
const segments: Segment[] = [
  { a: { x: 100, y: 100 }, b: { x: 700, y: 100 } },
  { a: { x: 320, y: 100 }, b: { x: 320, y: 40 } },
];

const texts: DrawingText[] = [
  t('MV-101', 200, 90),
  t('MV-102', 600, 90),
  t('PSV-101', 300, 60),
  t('2" VENT', 250, 75),
  t('2" VENT', 550, 75),
  t('PI', 400, 120, 8),
  t('101', 400, 127, 10),
];

const register = (suggestions: DrawingRegister['suggestions']): DrawingRegister => ({
  drawing: { number: null, title: null, revision: null, client: null },
  lines: [],
  equipment: [],
  valves: [],
  instruments: [],
  designData: {
    lineTag: null,
    designCode: null,
    pipeOd: null,
    wallThickness: null,
    length: null,
    designPressure: null,
    highPointElevation: null,
    lowPointElevation: null,
  },
  suggestions,
  notes: [],
});

const SUGGESTIONS: DrawingRegister['suggestions'] = [
  { action: 'boundary', nearTag: null, reason: 'Test section between MV-101 and MV-102.' },
  { action: 'valve', nearTag: 'MV-101', reason: 'Close as the upstream test limit.' },
  { action: 'valve', nearTag: 'MV-102', reason: 'Close as the downstream test limit.' },
  { action: 'blind', nearTag: 'PSV-101', reason: 'Isolate the relief valve.' },
  { action: 'vent', nearTag: '2" VENT', reason: 'Launcher side vent.' },
  { action: 'vent', nearTag: '2" VENT', reason: 'Receiver side vent.' },
  { action: 'gauge', nearTag: 'PI-101', reason: 'Test gauge.' },
  { action: 'drain', nearTag: 'XX-999', reason: 'Low point drain.' },
];

const run = (markups: Markup[] = [], suggestions = SUGGESTIONS) =>
  planAutoMarkup({ register: register(suggestions), texts, segments, page: 1, pageSize: { width: 1190, height: 842 }, markups, sectionId: 'sec-1' });

describe('planAutoMarkup', () => {
  const result = run();
  const byTag = (tag: string) => result.added.find((m) => m.tag === tag);

  it('places every located suggestion as an AI draft and reports what it could not place', () => {
    expect(result.added.map((m) => m.type)).toEqual(['valve', 'valve', 'blind', 'vent', 'vent', 'gauge', 'boundary']);
    expect(result.added.every((m) => m.aiDraft && m.page === 1 && m.sectionId === 'sec-1')).toBe(true);
    expect(result.skipped).toEqual([{ label: 'drain at XX-999', why: 'tag not found in the PDF text' }]);
  });

  it('puts test limit valves on the pipe under their tag, closed, keeping the drawing tag', () => {
    expect(byTag('MV-101')).toMatchObject({ points: [{ x: 200, y: 100 }], valvePosition: 'closed', tagLocked: true, notes: 'Close as the upstream test limit.' });
    expect(byTag('MV-102')?.points).toEqual([{ x: 600, y: 100 }]);
  });

  it('snaps the blind onto the vertical relief branch and turns it to match', () => {
    expect(byTag('B1')).toMatchObject({ points: [{ x: 320, y: 60 }], rotation: 90 });
  });

  it('sends repeated labels to their separate occurrences, left to right', () => {
    expect(byTag('V1')?.points).toEqual([{ x: 250, y: 100 }]);
    expect(byTag('V2')?.points).toEqual([{ x: 550, y: 100 }]);
  });

  it('finds the instrument bubble and puts the gauge on the pipe at its tapping', () => {
    expect(byTag('PI-101')?.points).toEqual([{ x: 400, y: 100 }]);
  });

  it('keeps a gauge clear of the drawn bubble when the tapping line runs into it', () => {
    // A tapping line from the pipe up into a bubble printed at (500, 60).
    const tapped = planAutoMarkup({
      register: register([{ action: 'gauge', nearTag: 'PI-201', reason: 'Gauge.' }]),
      texts: [t('PI', 500, 57, 8), t('201', 500, 64, 10)],
      segments: [{ a: { x: 500, y: 100 }, b: { x: 500, y: 60 } }],
      page: 1,
      pageSize: { width: 1190, height: 842 },
      markups: [],
    });
    const p = tapped.added[0].points[0];
    expect(p.x).toBe(500);
    expect(Math.hypot(p.x - 500, p.y - 60.5)).toBeGreaterThanOrEqual(18);
  });

  it('draws the boundary cloud around the test limit valves', () => {
    const boundary = result.added.find((m) => m.type === 'boundary');
    expect(boundary?.points).toEqual([
      { x: 166, y: 55 },
      { x: 634, y: 55 },
      { x: 634, y: 145 },
      { x: 166, y: 145 },
    ]);
  });

  it('adds nothing on a second run: every suggestion is already marked up', () => {
    const again = run(result.markups);
    expect(again.added).toEqual([]);
    expect(again.markups).toBe(result.markups);
  });

  it('spreads markups along the line instead of stacking them', () => {
    const both = run([], [
      { action: 'gauge', nearTag: 'PI-101', reason: 'Gauge.' },
      { action: 'recorder', nearTag: 'PI-101', reason: 'Recorder.' },
    ]);
    expect(both.added.map((m) => m.points[0])).toEqual([
      { x: 400, y: 100 },
      { x: 420, y: 100 },
    ]);
  });
});

describe('choosing where a tag is printed', () => {
  const extraTexts = [
    ...texts,
    // A drawing note, leftmost on the sheet, that mentions the relief valves.
    t('5. PSV-101 AND PSV-201 SET PRESSURE 99 barg.', 60, 700, 180),
    // A callout header, underlined, and the same line number labelled on the pipe.
    t('12"-EXP-001', 500, 20, 44, 8),
    t('12"-EXP-001', 650, 92, 44, 6),
  ];
  const extraSegments = [...segments, { a: { x: 478, y: 23 }, b: { x: 522, y: 23 } }];
  const plan = (suggestions: DrawingRegister['suggestions']) =>
    planAutoMarkup({
      register: register(suggestions),
      texts: extraTexts,
      segments: extraSegments,
      page: 1,
      pageSize: { width: 1190, height: 842 },
      markups: [],
    });

  it('uses the tag printed on its own, not a mention in the notes', () => {
    const { added } = plan([{ action: 'blind', nearTag: 'PSV-101', reason: 'Isolate.' }]);
    expect(added[0].points).toEqual([{ x: 320, y: 60 }]);
  });

  it('prefers the label on the pipe to an underlined callout header', () => {
    const { added } = plan([{ action: 'vent', nearTag: '12"-EXP-001', reason: 'High point vent.' }]);
    expect(added[0].points).toEqual([{ x: 650, y: 100 }]);
  });

  it('counts a draft placed at a later occurrence as done, so a second run adds nothing', () => {
    const suggestions: DrawingRegister['suggestions'] = [{ action: 'vent', nearTag: '12"-EXP-001', reason: 'High point vent.' }];
    const first = plan(suggestions);
    const again = planAutoMarkup({
      register: register(suggestions),
      texts: extraTexts,
      segments: extraSegments,
      page: 1,
      pageSize: { width: 1190, height: 842 },
      markups: first.markups,
    });
    expect(again.added).toEqual([]);
    expect(suggestionViews(register(suggestions), extraTexts, first.markups, 1)[0].done).toBe(true);
  });
});

describe('accepting and removing drafts', () => {
  const hand = createMarkup([], { type: 'blind', page: 1, points: [{ x: 900, y: 300 }] }).markups;
  const { markups } = run(hand);

  it('accepts one or all drafts', () => {
    expect(aiDraftCount(markups)).toBe(7);
    const one = acceptDrafts(markups, markups.find((m) => m.tag === 'MV-101')?.id);
    expect(aiDraftCount(one)).toBe(6);
    const all = acceptDrafts(markups);
    expect(aiDraftCount(all)).toBe(0);
    expect(all.find((m) => m.tag === 'MV-101')).not.toHaveProperty('aiDraft');
  });

  it('removes only the drafts and renumbers what is left', () => {
    const left = removeDrafts(markups);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ type: 'blind', tag: 'B1', points: [{ x: 900, y: 300 }] });
  });
});

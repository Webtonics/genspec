import { describe, expect, it } from 'vitest';
import type { DrawingText } from '@/markup/drawingText';
import type { Markup } from '@/model/types';
import { makeDefaultRules } from '@/rules';
import { designDataValues, locateTag, normalizeTag, suggestionViews } from './drawingRegister';
import type { DrawingRegister } from './types';

const t = (str: string, x: number, y: number, width = str.length * 4, height = 6): DrawingText => ({ str, x, y, width, height });

const texts: DrawingText[] = [
  t('MV-101', 300, 200),
  t('12"-EXP-001', 500, 180),
  t('PSV-101 SET 99 barg', 350, 120),
  t('KV', 700, 210, 8),
  t('-101', 712, 210, 16),
];

describe('normalizeTag', () => {
  it('ignores case, spaces and typographic quotes and dashes', () => {
    expect(normalizeTag('12\u2033 \u2013 exp-001')).toBe('12"-EXP-001');
  });
});

describe('locateTag', () => {
  it('finds an exact run', () => {
    expect(locateTag('MV-101', texts)).toEqual({ x: 300, y: 200 });
    expect(locateTag('12\u2033-EXP-001', texts)).toEqual({ x: 500, y: 180 });
  });

  it('finds a tag as a word inside a longer run', () => {
    expect(locateTag('PSV-101', texts)).toEqual({ x: 350, y: 120 });
  });

  it('joins a tag drawn as two runs on one line', () => {
    const at = locateTag('KV-101', texts);
    expect(at?.y).toBe(210);
    expect(at?.x).toBeGreaterThan(700);
    expect(at?.x).toBeLessThan(712);
  });

  it('finds an instrument bubble printed as letters over the number', () => {
    const bubble = [...texts, t('PI', 600, 300, 8), t('101', 600, 307, 10), t('PT', 900, 300, 8), t('102', 960, 307, 10)];
    expect(locateTag('PI-101', bubble)).toEqual({ x: 600, y: 303.5 });
    expect(locateTag('PI 101', bubble)).toEqual({ x: 600, y: 303.5 });
    // Letters and number too far apart sideways are not one bubble.
    expect(locateTag('PT-102', bubble)).toBeNull();
  });

  it('returns null for tags not on the page (scans, misreads)', () => {
    expect(locateTag('XV-999', texts)).toBeNull();
    expect(locateTag('', texts)).toBeNull();
  });
});

const register: DrawingRegister = {
  drawing: { number: 'DEC-PID-1001', title: null, revision: 'C', client: 'Delta Export Co.' },
  lines: [],
  equipment: [],
  valves: [],
  instruments: [],
  designData: {
    lineTag: '12"-EXP-001',
    designCode: 'ASME B31.4',
    pipeOd: { value: 323.9, unit: 'mm' },
    wallThickness: { value: 9.53, unit: 'mm' },
    length: { value: 12, unit: 'km' },
    designPressure: { value: 99, unit: 'barg' },
    highPointElevation: { value: 45, unit: 'm' },
    lowPointElevation: { value: 3, unit: 'm' },
  },
  suggestions: [
    { action: 'blind', nearTag: 'PSV-101', reason: 'Isolate the relief valve from test pressure.' },
    { action: 'valve', nearTag: 'MV-101', reason: 'Close as the launcher end test limit.' },
    { action: 'boundary', nearTag: null, reason: 'Cloud the test section.' },
  ],
  notes: [],
};

const markup = (over: Partial<Markup>): Markup => ({ id: 'm', type: 'blind', page: 1, points: [{ x: 0, y: 0 }], tag: 'B1', ...over });

describe('suggestionViews', () => {
  it('locates suggestions and marks them done once marked up nearby', () => {
    const before = suggestionViews(register, texts, [], 1);
    expect(before.map((s) => s.done)).toEqual([false, false, false]);
    expect(before[0].at).toEqual({ x: 350, y: 120 });

    const after = suggestionViews(
      register,
      texts,
      [
        markup({ type: 'blind', points: [{ x: 360, y: 150 }] }),
        markup({ id: 'v', type: 'valve', tag: 'MV-101', points: [{ x: 900, y: 900 }] }),
        markup({ id: 'b', type: 'boundary', points: [{ x: 1, y: 1 }, { x: 5, y: 5 }] }),
      ],
      1,
    );
    expect(after.map((s) => s.done)).toEqual([true, true, true]);
  });

  it('ignores markups on other pages or too far away', () => {
    const views = suggestionViews(register, texts, [markup({ points: [{ x: 360, y: 150 }], page: 2 }), markup({ points: [{ x: 800, y: 600 }] })], 1);
    expect(views[0].done).toBe(false);
  });
});

describe('designDataValues', () => {
  it('converts the drawing notes to section values without rule fills', () => {
    const { values } = designDataValues(register, 'ASME B31.4', makeDefaultRules());
    expect(values.lengthM?.value).toBe(12000);
    expect(values.odMm?.value).toBe(323.9);
    expect(values.nps?.value).toBe(12);
    expect(values.highPointElevM?.value).toBe(45);
    expect(values.holdHours).toBeUndefined();
  });
});

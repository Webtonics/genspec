import { describe, expect, it } from 'vitest';
import { makeDemoJobs } from '@/model/seed';
import type { Job, TestSection } from '@/model/types';
import { type RuleSet, makeDefaultRules } from '@/rules';
import { type CalcContext, calculateJob, calculateSection, resolveCalcOptions } from './section';

/** The 12", 9.53 mm WT, 12 km export line from the demo job (TP-012). */
const TP012: TestSection = {
  id: 'tp012',
  name: 'TP-012',
  nps: 12,
  odMm: 323.9,
  wtMm: 9.53,
  lengthM: 12000,
  designPressureBarg: 99,
  maxAllowableTestBarg: 130,
  highPointElevM: 45,
  lowPointElevM: 3,
  holdHours: 4,
};

function ctx(overrides: Partial<CalcContext> = {}, rules: RuleSet = makeDefaultRules()): CalcContext {
  return {
    medium: 'inhibited water',
    code: 'ASME B31.4',
    rules,
    options: resolveCalcOptions(undefined, rules),
    ...overrides,
  };
}

const step = (calc: ReturnType<typeof calculateSection>, key: string) =>
  calc.groups.flatMap((g) => g.steps).find((s) => s.key === key);

describe('calculateSection: 12" x 9.53 mm WT x 12 km, ASME B31.4, water', () => {
  const calc = calculateSection(TP012, ctx());

  it('matches the hand-worked values', () => {
    expect(calc.issues).toEqual([]);
    expect(calc.values.idMm).toBeCloseTo(304.84, 6);
    expect(calc.values.volumeM3).toBeCloseTo(875.82, 2);
    expect(calc.values.pumpRateM3h).toBeCloseTo(715.44, 2);
    expect(calc.values.fillTimeHours).toBeCloseTo(1.2242, 4);
    expect(calc.values.staticHeadBar).toBeCloseTo(4.1202, 6);
    expect(calc.values.highPointBarg).toBeCloseTo(123.75, 9);
    expect(calc.values.lowPointBarg).toBeCloseTo(127.8702, 6);
    expect(calc.values.purgeVolumeM3).toBeCloseTo(2627.46, 2);
    expect(calc.values.packingVolumeNm3).toBeCloseTo(2604.98, 2);
  });

  it('flags the low point AMBER with the margin', () => {
    expect(calc.flag?.flag).toBe('AMBER');
    expect(calc.flag?.amberFromBarg).toBeCloseTo(123.5, 9);
    expect(calc.flag?.marginBar).toBeCloseTo(2.1298, 6);
    expect(calc.flag?.message).toBe(
      'Low point test pressure 127.87 barg is within 5% of the max allowable 130.00 barg (margin 2.13 bar).',
    );
  });

  it('shows the working: formula, substituted inputs and result', () => {
    expect(step(calc, 'id')).toMatchObject({ formula: 'ID = OD - 2 × WT', substitution: '323.9 - 2 × 9.53', unit: 'mm' });
    expect(step(calc, 'volume')?.substitution).toBe('π/4 × (304.84 ÷ 1000)² × 12,000');
    expect(step(calc, 'pumpRate')?.substitution).toBe('3,150 × 3.78541 × 60 ÷ 1000');
    expect(step(calc, 'fillTime')?.substitution).toBe('875.82 ÷ 715.4');
    expect(step(calc, 'fillTime')?.note).toContain('1 h 13 min');
    expect(step(calc, 'head')?.substitution).toBe('0.0981 × 42.00');
    expect(step(calc, 'highPoint')?.substitution).toBe('1.25 × 99');
    expect(step(calc, 'lowPoint')?.substitution).toBe('123.75 + 4.12');
    expect(step(calc, 'packing')?.substitution).toBe('875.82 × (2 + 1.013) ÷ 1.013');
    expect(calc.groups.map((g) => g.key)).toEqual(['geometry', 'flooding', 'pressure', 'nitrogen']);
  });

  it('lists every input with its source, marking untouched rule values as defaults', () => {
    const byKey = Object.fromEntries(calc.inputs.map((i) => [i.key, i]));
    expect(byKey.od).toMatchObject({ value: 323.9, source: 'section' });
    expect(byKey.factor).toMatchObject({ value: 1.25, source: 'rule', ruleDefault: true });
    expect(byKey.gradient).toMatchObject({ value: 0.0981, source: 'rule', ruleDefault: true });
    expect(byKey.pumpFlow).toMatchObject({ value: 3150, source: 'rule', ruleDefault: true });
    expect(byKey.purgeVolumes).toMatchObject({ value: 3, source: 'rule', ruleDefault: true });
  });

  it('checks the hold period against the code minimum', () => {
    expect(calc.hold).toMatchObject({ ok: true, minimumMinutes: 240 });
    expect(calculateSection({ ...TP012, holdHours: 2 }, ctx()).hold?.ok).toBe(false);
  });
});

describe('calculateSection: rules and options', () => {
  it('uses the lifting pump when the job chooses it', () => {
    const rules = makeDefaultRules();
    const calc = calculateSection(TP012, ctx({ options: resolveCalcOptions({ pumpId: 'gppsl-lifting' }, rules) }, rules));
    expect(calc.values.pumpRateM3h).toBeCloseTo(1362.75, 2);
    expect(calc.values.fillTimeHours).toBeCloseTo(0.6427, 4);
  });

  it('turns RED when the max allowable is below the low point pressure', () => {
    const calc = calculateSection({ ...TP012, maxAllowableTestBarg: 125 }, ctx());
    expect(calc.flag?.flag).toBe('RED');
    expect(calc.flag?.message).toBe('Low point test pressure 127.87 barg exceeds the max allowable 125.00 barg by 2.87 bar.');
  });

  it('follows an edited rule table and stops calling it a default', () => {
    const rules = makeDefaultRules();
    rules.testCodes['ASME B31.4'].factor = 1.5;
    const calc = calculateSection(TP012, ctx({}, rules));
    expect(calc.values.highPointBarg).toBeCloseTo(148.5, 9);
    expect(calc.flag?.flag).toBe('RED');
    expect(calc.inputs.find((i) => i.key === 'factor')?.ruleDefault).toBe(false);
  });

  it('uses the ASME B31.3 factor of 1.5 and 10 min hold', () => {
    const calc = calculateSection({ ...TP012, maxAllowableTestBarg: 160, holdHours: 0.25 }, ctx({ code: 'ASME B31.3' }));
    expect(calc.values.highPointBarg).toBeCloseTo(148.5, 9);
    expect(calc.hold).toMatchObject({ ok: true, minimumMinutes: 10 });
  });

  it('asks for a factor when the job follows a client spec with none entered', () => {
    const calc = calculateSection(TP012, ctx({ code: 'Client spec' }));
    expect(calc.flag).toBeNull();
    expect(calc.values.highPointBarg).toBeUndefined();
    expect(calc.issues).toContain('Enter the Client spec test factor in Settings.');
    expect(calc.hold?.ok).toBeNull();
  });

  it('treats the static head of a gas-filled line as negligible and skips flooding', () => {
    const calc = calculateSection(TP012, ctx({ medium: 'nitrogen' }));
    expect(calc.values.staticHeadBar).toBe(0);
    expect(calc.values.lowPointBarg).toBeCloseTo(123.75, 9);
    expect(calc.values.fillTimeHours).toBeUndefined();
    expect(calc.groups.map((g) => g.key)).toEqual(['geometry', 'pressure', 'nitrogen']);
    expect(calc.groups.find((g) => g.key === 'pressure')?.notes[0]).toContain('pneumatic');
  });

  it('reports invalid geometry instead of calculating with it', () => {
    const calc = calculateSection({ ...TP012, wtMm: 170 }, ctx());
    expect(calc.issues).toContain('Wall thickness must be less than half the outside diameter.');
    expect(calc.values.volumeM3).toBeUndefined();
    expect(calc.groups.map((g) => g.key)).toEqual(['pressure']);
  });

  it('reports swapped elevations', () => {
    const calc = calculateSection({ ...TP012, highPointElevM: 3, lowPointElevM: 45 }, ctx());
    expect(calc.issues).toContain('High point elevation is below the low point elevation.');
    expect(calc.flag).toBeNull();
  });
});

describe('calculateJob on the demo jobs', () => {
  const [hydro, n2] = makeDemoJobs();
  const rules = makeDefaultRules();

  it('hydrotest job: TP-012 AMBER, TP-013 GREEN, worst AMBER', () => {
    const result = calculateJob(hydro, rules);
    expect(result.sections.map((s) => s.flag?.flag)).toEqual(['AMBER', 'GREEN']);
    expect(result.worst).toBe('AMBER');
    expect(result.sections[1].values.volumeM3).toBeCloseTo(12.597, 3);
    expect(result.sections[1].values.lowPointBarg).toBeCloseTo(124.11297, 5);
  });

  it('nitrogen job: 8" x 6.5 km volume and packing', () => {
    const result = calculateJob(n2, rules);
    expect(result.sections[0].values.volumeM3).toBeCloseTo(209.837, 3);
    expect(result.sections[0].values.packingVolumeNm3).toBeCloseTo(624.125, 3);
  });

  it('per-job options override the Settings defaults', () => {
    const job: Job = { ...hydro, calcOptions: { purgeVolumes: 5, packingPressureBarg: 1 } };
    const result = calculateJob(job, rules);
    expect(result.options.fromDefaults).toEqual({ pump: true, purgeVolumes: false, packingPressureBarg: false });
    expect(result.sections[0].values.purgeVolumeM3).toBeCloseTo(875.82 * 5, 1);
    expect(result.sections[0].inputs.find((i) => i.key === 'purgeVolumes')?.source).toBe('job');
  });
});

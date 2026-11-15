import { describe, expect, it } from 'vitest';
import { makeJob, makeSection } from '@/model/factory';
import type { Job } from '@/model/types';
import { makeDefaultRules } from '@/rules';
import { applyPlan, countSelected, defaultSelection, planDraft, proposeSectionValues } from './jobDraft';
import type { JobExtraction, SectionExtraction } from './types';

const rules = makeDefaultRules();

const blankSection = (over: Partial<SectionExtraction> = {}): SectionExtraction => ({
  name: null,
  nps: null,
  od: null,
  wt: null,
  length: null,
  designPressure: null,
  maxAllowableTest: null,
  highPointElevation: null,
  lowPointElevation: null,
  hold: null,
  ...over,
});

const extraction = (over: Partial<JobExtraction> = {}): JobExtraction => ({
  title: null,
  client: null,
  jobNo: null,
  medium: null,
  code: null,
  sections: [],
  notes: [],
  ...over,
});

/** "Hydrotest 12 km of 12 inch export line, WT 9.53 mm, design 99 barg to B31.4, high point 45 m, low point 3 m." */
const exportLine = blankSection({
  name: 'TP-012',
  nps: 12,
  wt: { value: 9.53, unit: 'mm' },
  length: { value: 12, unit: 'km' },
  designPressure: { value: 99, unit: 'barg' },
  highPointElevation: { value: 45, unit: 'm' },
  lowPointElevation: { value: 3, unit: 'm' },
});

describe('proposeSectionValues', () => {
  it('converts units and fills OD from NPS and hold from the B31.4 rule table', () => {
    const { values, notes } = proposeSectionValues(exportLine, { code: 'ASME B31.4', rules });
    expect(values.lengthM).toMatchObject({ value: 12000, origin: 'text', source: '12 km' });
    expect(values.odMm).toMatchObject({ value: 323.9, origin: 'rule' });
    expect(values.holdHours).toMatchObject({ value: 4, origin: 'rule', source: 'ASME B31.4 rule table' });
    expect(values.maxAllowableTestBarg).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it('snaps an inch OD to the B36.10M value (12.75 in is 323.85 mm, standard 323.9 mm)', () => {
    const { values } = proposeSectionValues(blankSection({ nps: 12, od: { value: 12.75, unit: 'in' } }), { code: 'ASME B31.4', rules });
    expect(values.odMm?.value).toBe(323.9);
    expect(values.odMm?.note).toMatch(/B36\.10M/);
  });

  it('works out the NPS from a standard OD when no size is given (323.9 mm is NPS 12)', () => {
    const { values } = proposeSectionValues(blankSection({ od: { value: 323.9, unit: 'mm' } }), { code: 'ASME B31.4', rules, fillFromRules: false });
    expect(values.nps).toMatchObject({ value: 12, origin: 'rule' });
    expect(proposeSectionValues(blankSection({ od: { value: 300, unit: 'mm' } }), { code: 'ASME B31.4', rules }).values.nps).toBeUndefined();
  });

  it('leaves the hold empty for a code without a rule value, and skips rule fills when asked', () => {
    expect(proposeSectionValues(exportLine, { code: 'ASME B31.8', rules }).values.holdHours).toBeUndefined();
    const { values } = proposeSectionValues(exportLine, { code: 'ASME B31.4', rules, fillFromRules: false });
    expect(values.odMm).toBeUndefined();
    expect(values.holdHours).toBeUndefined();
  });

  it('flags inverted elevations and a max test below design', () => {
    const { notes } = proposeSectionValues(
      blankSection({
        highPointElevation: { value: 2, unit: 'm' },
        lowPointElevation: { value: 10, unit: 'm' },
        designPressure: { value: 99, unit: 'barg' },
        maxAllowableTest: { value: 90, unit: 'barg' },
      }),
      { code: 'ASME B31.4', rules },
    );
    expect(notes).toHaveLength(2);
  });

  it('ignores impossible values (zero length, negative pressure)', () => {
    const { values } = proposeSectionValues(
      blankSection({ length: { value: 0, unit: 'km' }, designPressure: { value: -5, unit: 'barg' } }),
      { code: 'ASME B31.4', rules },
    );
    expect(values.lengthM).toBeUndefined();
    expect(values.designPressureBarg).toBeUndefined();
  });
});

describe('planDraft', () => {
  const newJob = (): Job => makeJob([], { title: 'New job' });

  it('fills the blank first section of a new job and proposes job fields', () => {
    const job = newJob();
    const plan = planDraft(
      job,
      extraction({ title: 'Export line hydrotest', client: 'Delta Export Co.', medium: 'inhibited water', code: 'ASME B31.4', sections: [exportLine] }),
      rules,
    );
    expect(plan.job.map((c) => c.key)).toEqual(['title', 'client', 'medium', 'code']);
    expect(plan.job.find((c) => c.key === 'medium')?.same).toBe(true);
    const s = plan.sections[0];
    expect(s.target).toEqual({ kind: 'update', sectionId: job.sections[0].id, name: 'TP-001' });
    expect(s.rename).toEqual({ id: 's0.name', from: 'TP-001', to: 'TP-012' });
    expect(s.missing.map((m) => m.key)).toEqual(['maxAllowableTestBarg']);
  });

  it('updates a section with the same name and marks matching values as unchanged', () => {
    const job = newJob();
    job.sections = [makeSection('TP-012', { lengthM: 12000, designPressureBarg: 99, maxAllowableTestBarg: 130, wtMm: 9.53 })];
    const plan = planDraft(job, extraction({ sections: [exportLine] }), rules);
    const s = plan.sections[0];
    expect(s.target.kind).toBe('update');
    expect(s.rename).toBeUndefined();
    expect(s.changes.find((c) => c.key === 'lengthM')?.same).toBe(true);
    expect(s.changes.find((c) => c.key === 'highPointElevM')?.same).toBe(false);
  });

  it('adds new sections with the next TP number when names are not given', () => {
    const job = newJob();
    job.sections = [makeSection('TP-012', { designPressureBarg: 99 })];
    const plan = planDraft(job, extraction({ sections: [blankSection({ nps: 8 }), blankSection({ nps: 6 })] }), rules);
    expect(plan.sections.map((s) => s.target)).toEqual([
      { kind: 'new', name: 'TP-013' },
      { kind: 'new', name: 'TP-014' },
    ]);
  });

  it('applies only the selected changes', () => {
    const job = newJob();
    const plan = planDraft(job, extraction({ title: 'Export line hydrotest', sections: [exportLine] }), rules);
    const selected = defaultSelection(plan);
    expect(countSelected(plan, selected)).toBeGreaterThan(5);
    selected.delete('s0.highPointElevM');
    const applied = applyPlan(plan, selected);
    expect(applied.jobPatch).toEqual({ title: 'Export line hydrotest' });
    expect(applied.updates).toHaveLength(1);
    expect(applied.updates[0].patch).toMatchObject({ name: 'TP-012', lengthM: 12000, lowPointElevM: 3 });
    expect(applied.updates[0].patch.highPointElevM).toBeUndefined();
    // The blank section already has the 323.9 mm OD, so that unchanged value is not written.
    expect(applied.updates[0].patch.odMm).toBeUndefined();
    expect(applied.additions).toEqual([]);
  });
});

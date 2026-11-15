/**
 * Turns what the AI read from a job description (or a drawing) into a reviewable
 * list of proposed changes. Units are converted here, standard values come from the
 * rule tables, and nothing reaches the job until the engineer applies it.
 */
import { fmtMinutes, fmtValue } from '@/lib/format';
import { TEST_CODES, MEDIUM_LABELS, TEST_CODE_LABELS } from '@/model/options';
import { nextSectionName } from '@/model/factory';
import type { Job, Medium, TestCode, TestSection } from '@/model/types';
import type { RuleSet } from '@/rules';
import { npsForOd, standardOd } from '@/rules/pipeSizes';
import type { JobExtraction, Quantity, SectionExtraction } from './types';
import { type Converted, durationToHours, elevationToM, lengthToM, pressureToBarg, sizeToMm } from './units';

export type SectionField = Exclude<keyof TestSection, 'id' | 'name'>;

export const SECTION_FIELDS: { key: SectionField; label: string; unit: string }[] = [
  { key: 'nps', label: 'NPS', unit: 'in' },
  { key: 'odMm', label: 'Outside diameter', unit: 'mm' },
  { key: 'wtMm', label: 'Wall thickness', unit: 'mm' },
  { key: 'lengthM', label: 'Length', unit: 'm' },
  { key: 'designPressureBarg', label: 'Design pressure', unit: 'barg' },
  { key: 'maxAllowableTestBarg', label: 'Max allowable test', unit: 'barg' },
  { key: 'highPointElevM', label: 'High point EL', unit: 'm' },
  { key: 'lowPointElevM', label: 'Low point EL', unit: 'm' },
  { key: 'holdHours', label: 'Hold', unit: 'h' },
];

/** A proposed value: from the text (as read, then converted) or from a rule table. */
export type Proposal = Converted & { origin: 'text' | 'rule' };

export type SectionValues = Partial<Record<SectionField, Proposal>>;

const valid = (q: Quantity, min: number | null, exclusive = false): q is NonNullable<Quantity> =>
  q !== null && Number.isFinite(q.value) && (min === null || (exclusive ? q.value > min : q.value >= min));

/** OD snaps to the ASME B36.10M value when a converted inch OD lands within 0.15 mm of it. */
const SNAP_MM = 0.15;

/**
 * Section values in model units from one extracted section. With `fillFromRules`, a
 * missing OD comes from the NPS (ASME B36.10M) and a missing hold from the code's rule table.
 */
export function proposeSectionValues(
  x: SectionExtraction,
  opts: { code: TestCode; rules: RuleSet; fillFromRules?: boolean },
): { values: SectionValues; notes: string[] } {
  const values: SectionValues = {};
  const notes: string[] = [];
  const text = (c: Converted): Proposal => ({ ...c, origin: 'text' });
  const fill = opts.fillFromRules ?? true;

  const nps = x.nps !== null && Number.isFinite(x.nps) && x.nps > 0 ? x.nps : null;
  if (nps !== null) values.nps = { value: nps, source: `NPS ${fmtValue(nps)}`, origin: 'text' };
  const std = nps !== null ? standardOd(nps) : undefined;

  if (valid(x.od, 0, true)) {
    const od = sizeToMm(x.od);
    if (od.working && std !== undefined && Math.abs(od.value - std) <= SNAP_MM) {
      values.odMm = text({ ...od, value: std, note: `Matches the ASME B36.10M outside diameter for NPS ${fmtValue(nps ?? 0)}.` });
    } else {
      values.odMm = text(od);
    }
  } else if (fill && std !== undefined) {
    values.odMm = { value: std, source: `NPS ${fmtValue(nps ?? 0)}`, working: `ASME B36.10M outside diameter for NPS ${fmtValue(nps ?? 0)}`, origin: 'rule' };
  }

  // OD given without a size: the NPS follows from the standard table, so NPS and OD never disagree.
  const od = values.odMm?.value;
  const npsFromOd = nps === null && od !== undefined ? npsForOd(od) : undefined;
  if (npsFromOd !== undefined) {
    values.nps = {
      value: npsFromOd,
      source: `OD ${fmtValue(od ?? 0)} mm`,
      working: `ASME B36.10M: ${fmtValue(standardOd(npsFromOd) ?? 0)} mm outside diameter is NPS ${fmtValue(npsFromOd)}`,
      origin: 'rule',
    };
  }

  if (valid(x.wt, 0, true)) values.wtMm = text(sizeToMm(x.wt));
  if (valid(x.length, 0, true)) values.lengthM = text(lengthToM(x.length));
  if (valid(x.designPressure, 0)) values.designPressureBarg = text(pressureToBarg(x.designPressure));
  if (valid(x.maxAllowableTest, 0)) values.maxAllowableTestBarg = text(pressureToBarg(x.maxAllowableTest));
  if (valid(x.highPointElevation, null)) values.highPointElevM = text(elevationToM(x.highPointElevation));
  if (valid(x.lowPointElevation, null)) values.lowPointElevM = text(elevationToM(x.lowPointElevation));

  if (valid(x.hold, 0, true)) {
    values.holdHours = text(durationToHours(x.hold));
  } else if (fill) {
    const minutes = opts.rules.testCodes[opts.code]?.minHoldMinutes;
    if (minutes !== null && minutes !== undefined) {
      const hours = Math.round((minutes / 60) * 1000) / 1000;
      values.holdHours = {
        value: hours,
        source: `${opts.code} rule table`,
        working: `Minimum hold ${fmtMinutes(minutes)} (default, confirm with engineer)`,
        origin: 'rule',
      };
    }
  }

  const high = values.highPointElevM?.value;
  const low = values.lowPointElevM?.value;
  if (high !== undefined && low !== undefined && high < low) notes.push('The high point is below the low point. Check the elevations.');
  const design = values.designPressureBarg?.value;
  const maxTest = values.maxAllowableTestBarg?.value;
  if (design !== undefined && maxTest !== undefined && maxTest < design) {
    notes.push('The maximum allowable test pressure is below the design pressure. Check both values.');
  }
  return { values, notes };
}

/** Values are the same if they agree to display precision. */
export function sameValue(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

// ---------------------------------------------------------------------------
// Review plan
// ---------------------------------------------------------------------------

export type JobField = 'title' | 'client' | 'jobNo' | 'medium' | 'code';

export type JobChange = { id: string; key: JobField; label: string; current: string; proposed: string; display: string; same: boolean };

export type FieldChange = {
  id: string;
  key: SectionField;
  label: string;
  unit: string;
  /** null for a new section. */
  current: number | null;
  proposal: Proposal;
  same: boolean;
};

export type SectionTarget = { kind: 'update'; sectionId: string; name: string } | { kind: 'new'; name: string };

export type SectionPlan = {
  id: string;
  target: SectionTarget;
  /** Rename of the target section, when the description names it differently. */
  rename?: { id: string; from: string; to: string };
  changes: FieldChange[];
  /** Fields the description did not give. New sections take the blank-section default. */
  missing: { key: SectionField; label: string }[];
  notes: string[];
};

export type DraftPlan = { job: JobChange[]; sections: SectionPlan[]; notes: string[] };

const JOB_LABELS: Record<JobField, string> = { title: 'Job title', client: 'Client', jobNo: 'Job number', medium: 'Test medium', code: 'Governing code' };

/** A section still holding the blank defaults (no pressures entered yet). */
const isBlank = (s: TestSection) => s.designPressureBarg === 0 && s.maxAllowableTestBarg === 0;

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');

/** Which section each extracted section goes to: same name, else the only blank section, else a new one. */
function targetsFor(job: Job, sections: SectionExtraction[]): SectionTarget[] {
  const used = new Set<string>();
  const newNames: { name: string }[] = [];
  const named = sections.map((x) => (x.name ? job.sections.find((s) => norm(s.name) === norm(x.name ?? '')) : undefined));
  named.forEach((s) => s && used.add(s.id));
  return sections.map((x, i) => {
    const match = named[i];
    if (match) return { kind: 'update', sectionId: match.id, name: match.name };
    if (sections.length === 1 && job.sections.length === 1 && isBlank(job.sections[0]) && !used.has(job.sections[0].id)) {
      used.add(job.sections[0].id);
      return { kind: 'update', sectionId: job.sections[0].id, name: job.sections[0].name };
    }
    const name = x.name?.trim() || nextSectionName([...job.sections, ...newNames]);
    newNames.push({ name });
    return { kind: 'new', name };
  });
}

export function planDraft(job: Job, x: JobExtraction, rules: RuleSet): DraftPlan {
  const jobChanges: JobChange[] = [];
  const addJob = (key: JobField, proposed: string | null, display?: string) => {
    const value = proposed?.trim();
    if (!value) return;
    const current = String(job[key] ?? '');
    jobChanges.push({ id: `job.${key}`, key, label: JOB_LABELS[key], current, proposed: value, display: display ?? value, same: current === value });
  };
  addJob('title', x.title);
  addJob('client', x.client);
  addJob('jobNo', x.jobNo);
  if (x.medium && x.medium in MEDIUM_LABELS) addJob('medium', x.medium, MEDIUM_LABELS[x.medium as Medium]);
  if (x.code && (TEST_CODES as readonly string[]).includes(x.code)) addJob('code', x.code, TEST_CODE_LABELS[x.code as TestCode]);

  const code = (x.code && (TEST_CODES as readonly string[]).includes(x.code) ? x.code : job.code) as TestCode;
  const targets = targetsFor(job, x.sections);

  const sections = x.sections.map((sx, i): SectionPlan => {
    const id = `s${i}`;
    const target = targets[i];
    const existing = target.kind === 'update' ? job.sections.find((s) => s.id === target.sectionId) : undefined;
    const { values, notes } = proposeSectionValues(sx, { code, rules });
    const changes: FieldChange[] = [];
    const missing: SectionPlan['missing'] = [];
    for (const f of SECTION_FIELDS) {
      const proposal = values[f.key];
      if (!proposal) {
        missing.push({ key: f.key, label: f.label });
        continue;
      }
      const current = existing ? existing[f.key] : null;
      changes.push({ id: `${id}.${f.key}`, key: f.key, label: f.label, unit: f.unit, current, proposal, same: current !== null && sameValue(current, proposal.value) });
    }
    const wanted = sx.name?.trim();
    const rename = existing && wanted && norm(wanted) !== norm(existing.name) ? { id: `${id}.name`, from: existing.name, to: wanted } : undefined;
    return { id, target, rename, changes, missing, notes };
  });

  return { job: jobChanges, sections, notes: x.notes.filter((n) => n.trim()) };
}

/** Ids of every change that would alter the job: the default selection in the review. */
export function defaultSelection(plan: DraftPlan): Set<string> {
  const ids = new Set<string>();
  plan.job.forEach((c) => !c.same && ids.add(c.id));
  for (const s of plan.sections) {
    if (s.rename) ids.add(s.rename.id);
    s.changes.forEach((c) => (!c.same || s.target.kind === 'new') && ids.add(c.id));
  }
  return ids;
}

export type AppliedDraft = {
  jobPatch: Partial<Pick<Job, JobField>>;
  updates: { sectionId: string; patch: Partial<Omit<TestSection, 'id'>> }[];
  additions: { name: string; values: Partial<Omit<TestSection, 'id'>> }[];
};

/** The store writes for the selected changes. */
export function applyPlan(plan: DraftPlan, selected: Set<string>): AppliedDraft {
  const jobPatch: AppliedDraft['jobPatch'] = {};
  for (const c of plan.job) {
    if (!selected.has(c.id)) continue;
    if (c.key === 'medium') jobPatch.medium = c.proposed as Medium;
    else if (c.key === 'code') jobPatch.code = c.proposed as TestCode;
    else jobPatch[c.key] = c.proposed;
  }
  const updates: AppliedDraft['updates'] = [];
  const additions: AppliedDraft['additions'] = [];
  for (const s of plan.sections) {
    const patch: Partial<Omit<TestSection, 'id'>> = {};
    for (const c of s.changes) if (selected.has(c.id)) patch[c.key] = c.proposal.value;
    if (s.target.kind === 'update') {
      if (s.rename && selected.has(s.rename.id)) patch.name = s.rename.to;
      if (Object.keys(patch).length) updates.push({ sectionId: s.target.sectionId, patch });
    } else if (Object.keys(patch).length) {
      additions.push({ name: s.target.name, values: patch });
    }
  }
  return { jobPatch, updates, additions };
}

/** Number of selected changes that would actually alter the job. */
export function countSelected(plan: DraftPlan, selected: Set<string>): number {
  let n = plan.job.filter((c) => selected.has(c.id) && !c.same).length;
  for (const s of plan.sections) {
    if (s.rename && selected.has(s.rename.id)) n++;
    n += s.changes.filter((c) => selected.has(c.id) && (!c.same || s.target.kind === 'new')).length;
  }
  return n;
}

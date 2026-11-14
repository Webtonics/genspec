import type { Job, TestSection } from './types';

/**
 * Unique id. Falls back to a time and random based id where crypto.randomUUID is
 * unavailable (it only exists in secure contexts, so not when served over plain
 * http on a LAN address).
 */
export function uid(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

/** Highest trailing number across a set of labels, e.g. ["TP-012", "TP-013"] gives 13. */
function maxTrailingNumber(labels: string[]): number {
  return labels.reduce((max, label) => {
    const match = /(\d+)\s*$/.exec(label);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

/** Next test section name, continuing the TP-nnn sequence. */
export function nextSectionName(sections: Pick<TestSection, 'name'>[]): string {
  const next = maxTrailingNumber(sections.map((s) => s.name)) + 1;
  return `TP-${String(next).padStart(3, '0')}`;
}

/** Next job number in the form GPPSL-YY-NNNN, continuing from the highest existing number. */
export function nextJobNo(jobs: Pick<Job, 'jobNo'>[], today: Date = new Date()): string {
  const yy = String(today.getFullYear() % 100).padStart(2, '0');
  const next = maxTrailingNumber(jobs.map((j) => j.jobNo)) + 1;
  return `GPPSL-${yy}-${String(next).padStart(4, '0')}`;
}

/**
 * A blank test section. Pipe defaults are a 12 inch (323.9 mm OD, 9.53 mm WT)
 * line; every value is expected to be replaced by the engineer in Job setup.
 */
export function makeSection(name: string, overrides: Partial<Omit<TestSection, 'id'>> = {}): TestSection {
  return {
    id: uid('sec'),
    name,
    nps: 12,
    odMm: 323.9,
    wtMm: 9.53,
    lengthM: 1000,
    designPressureBarg: 0,
    maxAllowableTestBarg: 0,
    highPointElevM: 0,
    lowPointElevM: 0,
    holdHours: 4,
    ...overrides,
  };
}

/** A new job: FOR REVIEW at revision A, one empty test section, no drawing or markups. */
export function makeJob(existingJobs: Pick<Job, 'jobNo'>[], overrides: Partial<Omit<Job, 'id'>> = {}): Job {
  return {
    id: uid('job'),
    title: 'New job',
    client: '',
    jobNo: nextJobNo(existingJobs),
    medium: 'inhibited water',
    code: 'ASME B31.4',
    sections: [makeSection('TP-001')],
    markups: [],
    status: 'FOR REVIEW',
    revision: 'A',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

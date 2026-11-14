import { describe, expect, it } from 'vitest';
import { DEMO_JOB_IDS, makeDemoJobs } from './seed';

describe('demo jobs', () => {
  const jobs = makeDemoJobs();

  it('seeds the two demo jobs with stable ids', () => {
    expect(jobs.map((j) => j.id)).toEqual([DEMO_JOB_IDS.hydrotest, DEMO_JOB_IDS.nitrogen]);
  });

  it('uses unique section ids across all jobs', () => {
    const ids = jobs.flatMap((j) => j.sections.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns fresh copies, so editing one does not leak into the next reset', () => {
    const first = makeDemoJobs();
    first[0].title = 'Edited';
    first[0].sections[0].lengthM = 1;
    const second = makeDemoJobs();
    expect(second[0].title).not.toBe('Edited');
    expect(second[0].sections[0].lengthM).toBe(12000);
  });

  it('has one job FOR REVIEW without a stamp and one APPROVED with name and date', () => {
    const [hydro, n2] = jobs;
    expect(hydro.status).toBe('FOR REVIEW');
    expect(hydro.approvedBy).toBeUndefined();
    expect(n2.status).toBe('APPROVED');
    expect(n2.approvedBy).toBeTruthy();
    expect(Number.isNaN(Date.parse(n2.approvedAt ?? ''))).toBe(false);
  });

  it('has physically sensible sections', () => {
    for (const s of jobs.flatMap((j) => j.sections)) {
      expect(s.wtMm).toBeGreaterThan(0);
      expect(s.wtMm).toBeLessThan(s.odMm / 2);
      expect(s.lengthM).toBeGreaterThan(0);
      expect(s.highPointElevM).toBeGreaterThan(s.lowPointElevM);
      expect(s.maxAllowableTestBarg).toBeGreaterThan(s.designPressureBarg);
    }
  });

  it('includes the 12 inch, 9.53 mm WT, 12 km export line section', () => {
    expect(jobs[0].sections[0]).toMatchObject({ name: 'TP-012', nps: 12, odMm: 323.9, wtMm: 9.53, lengthM: 12000 });
  });
});

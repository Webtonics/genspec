import { describe, expect, it } from 'vitest';
import { makeJob } from '@/model/factory';
import { DEMO_JOB_IDS, makeDemoJobs, makeSampleDrawing } from '@/model/seed';
import type { Job } from '@/model/types';
import { JOB_STORE_VERSION, migrateJobState } from './migrations';

/** Demo jobs as a v1 build saved them: no drawing attached. */
const v1Jobs = (): Job[] => makeDemoJobs().map(({ drawing: _drawing, ...job }) => job);

describe('migrateJobState', () => {
  it('is at version 2', () => {
    expect(JOB_STORE_VERSION).toBe(2);
  });

  it('v1 to v2 attaches the sample P&ID to the demo hydrotest job', () => {
    const out = migrateJobState({ jobs: v1Jobs(), activeJobId: DEMO_JOB_IDS.hydrotest }, 1);
    const hydro = out.jobs.find((j) => j.id === DEMO_JOB_IDS.hydrotest);
    expect(hydro?.drawing).toEqual(makeSampleDrawing());
    expect(out.activeJobId).toBe(DEMO_JOB_IDS.hydrotest);
  });

  it('leaves other jobs and user edits alone', () => {
    const jobs = v1Jobs();
    jobs[0].title = 'Renamed by the user';
    const custom = makeJob([], { title: 'My job' });
    const out = migrateJobState({ jobs: [...jobs, custom], activeJobId: custom.id }, 1);
    expect(out.jobs[0].title).toBe('Renamed by the user');
    expect(out.jobs.find((j) => j.id === DEMO_JOB_IDS.nitrogen)?.drawing).toBeUndefined();
    expect(out.jobs.find((j) => j.id === custom.id)).toEqual(custom);
    expect(out.activeJobId).toBe(custom.id);
  });

  it('does not bring back a demo job the user deleted', () => {
    const jobs = v1Jobs().filter((j) => j.id !== DEMO_JOB_IDS.hydrotest);
    const out = migrateJobState({ jobs, activeJobId: null }, 1);
    expect(out.jobs.map((j) => j.id)).toEqual([DEMO_JOB_IDS.nitrogen]);
  });

  it('survives corrupt storage', () => {
    expect(migrateJobState(null, 1)).toEqual({ jobs: [], activeJobId: null });
    expect(migrateJobState({ jobs: 'nope' }, 1)).toEqual({ jobs: [], activeJobId: null });
  });
});

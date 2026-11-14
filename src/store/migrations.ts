import { DEMO_JOB_IDS, makeSampleDrawing } from '@/model/seed';
import type { Job } from '@/model/types';

/** Bump when the shape or seeded content of persisted job data changes, and add a step below. */
export const JOB_STORE_VERSION = 2;

export type PersistedJobState = { jobs: Job[]; activeJobId: string | null };

/**
 * Upgrade job data saved in localStorage by an older build, so existing browsers
 * pick up changes without losing their work.
 *
 * v1 to v2: the demo hydrotest job ships with the sample P&ID attached.
 */
export function migrateJobState(persisted: unknown, fromVersion: number): PersistedJobState {
  const state = persisted as Partial<PersistedJobState> | null;
  let jobs = Array.isArray(state?.jobs) ? state.jobs : [];

  if (fromVersion < 2) {
    jobs = jobs.map((job) =>
      job.id === DEMO_JOB_IDS.hydrotest && !job.drawing ? { ...job, drawing: makeSampleDrawing() } : job,
    );
  }

  return { jobs, activeJobId: state?.activeJobId ?? jobs[0]?.id ?? null };
}

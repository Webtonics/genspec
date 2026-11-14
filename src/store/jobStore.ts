import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { makeJob, makeSection, nextSectionName } from '@/model/factory';
import { nextRevision } from '@/model/revision';
import { DEMO_JOB_IDS, makeDemoJobs } from '@/model/seed';
import type { Job, TestSection } from '@/model/types';
import { JOB_STORE_VERSION, migrateJobState } from './migrations';

type JobPatch = Partial<Omit<Job, 'id'>>;
type SectionPatch = Partial<Omit<TestSection, 'id'>>;

type JobState = {
  jobs: Job[];
  /** The job the sidebar's job pages point at. Follows whichever job was last opened. */
  activeJobId: string | null;

  setActiveJob: (jobId: string | null) => void;
  createJob: (overrides?: JobPatch) => Job;
  updateJob: (jobId: string, patch: JobPatch) => void;
  deleteJob: (jobId: string) => void;

  addSection: (jobId: string, overrides?: SectionPatch) => TestSection | undefined;
  updateSection: (jobId: string, sectionId: string, patch: SectionPatch) => void;
  removeSection: (jobId: string, sectionId: string) => void;

  /** Stamp the engineer's name and the time on the current revision. */
  approveJob: (jobId: string, engineer: string) => void;
  /** Send an approved job back to FOR REVIEW at the same revision. */
  withdrawApproval: (jobId: string) => void;
  /** Record a client comment: bump the revision letter and send the job back for review. */
  addClientComment: (jobId: string, text: string, markupId?: string) => void;

  /** Replace every stored job with the two seeded demo jobs. */
  resetDemoData: () => void;
};

const mapJob = (jobs: Job[], jobId: string, fn: (job: Job) => Job) =>
  jobs.map((job) => (job.id === jobId ? fn(job) : job));

export const useJobStore = create<JobState>()(
  persist(
    (set, get) => ({
      jobs: makeDemoJobs(),
      activeJobId: DEMO_JOB_IDS.hydrotest,

      setActiveJob: (jobId) => {
        if (get().activeJobId !== jobId) set({ activeJobId: jobId });
      },

      createJob: (overrides) => {
        const job = makeJob(get().jobs, overrides);
        set((s) => ({ jobs: [job, ...s.jobs], activeJobId: job.id }));
        return job;
      },

      updateJob: (jobId, patch) =>
        set((s) => ({ jobs: mapJob(s.jobs, jobId, (job) => ({ ...job, ...patch })) })),

      deleteJob: (jobId) =>
        set((s) => {
          const jobs = s.jobs.filter((j) => j.id !== jobId);
          const activeJobId = s.activeJobId === jobId ? (jobs[0]?.id ?? null) : s.activeJobId;
          return { jobs, activeJobId };
        }),

      addSection: (jobId, overrides) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return undefined;
        const section = makeSection(nextSectionName(job.sections), overrides);
        set((s) => ({ jobs: mapJob(s.jobs, jobId, (j) => ({ ...j, sections: [...j.sections, section] })) }));
        return section;
      },

      updateSection: (jobId, sectionId, patch) =>
        set((s) => ({
          jobs: mapJob(s.jobs, jobId, (j) => ({
            ...j,
            sections: j.sections.map((sec) => (sec.id === sectionId ? { ...sec, ...patch } : sec)),
          })),
        })),

      removeSection: (jobId, sectionId) =>
        set((s) => ({
          jobs: mapJob(s.jobs, jobId, (j) => ({
            ...j,
            sections: j.sections.filter((sec) => sec.id !== sectionId),
            // Markups assigned to the removed section become unassigned rather than dangling.
            markups: j.markups.map((m) => (m.sectionId === sectionId ? { ...m, sectionId: undefined } : m)),
          })),
        })),

      approveJob: (jobId, engineer) => {
        const by = engineer.trim();
        if (!by) return;
        const at = new Date().toISOString();
        set((s) => ({
          jobs: mapJob(s.jobs, jobId, (j) => ({
            ...j,
            status: 'APPROVED',
            approvedBy: by,
            approvedAt: at,
            history: [...(j.history ?? []), { kind: 'approval', rev: j.revision, at, by }],
          })),
        }));
      },

      withdrawApproval: (jobId) =>
        set((s) => ({
          jobs: mapJob(s.jobs, jobId, ({ approvedBy: _by, approvedAt: _at, ...j }) => ({ ...j, status: 'FOR REVIEW' })),
        })),

      addClientComment: (jobId, text, markupId) => {
        const comment = text.trim();
        if (!comment) return;
        const at = new Date().toISOString();
        set((s) => ({
          jobs: mapJob(s.jobs, jobId, ({ approvedBy: _by, approvedAt: _at, ...j }) => {
            const rev = nextRevision(j.revision);
            return {
              ...j,
              revision: rev,
              status: 'FOR REVIEW',
              history: [...(j.history ?? []), { kind: 'comment', rev, at, text: comment, ...(markupId ? { markupId } : {}) }],
            };
          }),
        }));
      },

      resetDemoData: () => set({ jobs: makeDemoJobs(), activeJobId: DEMO_JOB_IDS.hydrotest }),
    }),
    {
      name: 'genspec-jobs',
      version: JOB_STORE_VERSION,
      migrate: migrateJobState,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ jobs: s.jobs, activeJobId: s.activeJobId }),
    },
  ),
);

/** Select one job by id. Returns the stored object, so it only re-renders when that job changes. */
export const useJob = (jobId: string | undefined) =>
  useJobStore((s) => (jobId ? s.jobs.find((j) => j.id === jobId) : undefined));

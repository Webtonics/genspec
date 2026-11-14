import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Job } from '@/model/types';
import { type SpreadParams, defaultSpreadParams } from '@/spread/templates';

type StoredParams = Partial<SpreadParams>;

type SpreadState = {
  /** Last spread choices per job, merged over the defaults. */
  byJob: Record<string, StoredParams>;
  setParams: (jobId: string, params: SpreadParams) => void;
};

export const useSpreadStore = create<SpreadState>()(
  persist(
    (set) => ({
      byJob: {},
      setParams: (jobId, params) => set((s) => ({ byJob: { ...s.byJob, [jobId]: params } })),
    }),
    {
      name: 'genspec-spread',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ byJob: s.byJob }),
    },
  ),
);

/** Stored choices over the defaults, dropping a section that no longer exists. */
export function resolveSpreadParams(job: Job, stored: StoredParams | undefined): SpreadParams {
  const d = defaultSpreadParams(job);
  if (!stored) return d;
  return {
    template: stored.template ?? d.template,
    sectionId: job.sections.some((s) => s.id === stored.sectionId) ? stored.sectionId : d.sectionId,
    flooding: { ...d.flooding, ...stored.flooding },
    nitrogen: { ...d.nitrogen, ...stored.nitrogen },
    dewatering: { ...d.dewatering, ...stored.dewatering },
  };
}

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FieldsByMarkup } from '@/lists/buildLists';

type ListState = {
  /** Extra list fields per job, keyed by markup id then column key. */
  byJob: Record<string, FieldsByMarkup>;
  /** Set a field, or remove it with undefined so the default applies again. */
  setField: (jobId: string, markupId: string, key: string, value: string | undefined) => void;
};

/**
 * Fields that only exist on the lists (blind rating, joint gasket, calibration
 * dates...). Keyed by markup id, so a markup brought back by undo gets its
 * fields back too. Rows themselves always come from the markups.
 */
export const useListStore = create<ListState>()(
  persist(
    (set) => ({
      byJob: {},
      setField: (jobId, markupId, key, value) =>
        set((s) => {
          const job = { ...(s.byJob[jobId] ?? {}) };
          const row = { ...(job[markupId] ?? {}) };
          if (value === undefined) delete row[key];
          else row[key] = value;
          if (Object.keys(row).length > 0) job[markupId] = row;
          else delete job[markupId];
          return { byJob: { ...s.byJob, [jobId]: job } };
        }),
    }),
    {
      name: 'genspec-lists',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ byJob: s.byJob }),
    },
  ),
);

const EMPTY: FieldsByMarkup = {};

export const useJobListFields = (jobId: string) => useListStore((s) => s.byJob[jobId] ?? EMPTY);

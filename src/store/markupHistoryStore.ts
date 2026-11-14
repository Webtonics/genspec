import { create } from 'zustand';
import type { Markup } from '@/model/types';
import { useJobStore } from './jobStore';

const LIMIT = 100;

type History = { past: Markup[][]; future: Markup[][] };

type HistoryState = {
  byJob: Record<string, History>;
  /** Save a new markups array to the job, keeping the previous one for undo. */
  commit: (jobId: string, next: Markup[]) => void;
  undo: (jobId: string) => void;
  redo: (jobId: string) => void;
};

const empty: History = { past: [], future: [] };
const currentMarkups = (jobId: string) => useJobStore.getState().jobs.find((j) => j.id === jobId)?.markups;
const writeMarkups = (jobId: string, markups: Markup[]) => useJobStore.getState().updateJob(jobId, { markups });

/**
 * Undo and redo for markup edits, per job, for the browser session. Markups are
 * written to the job straight away, so the lists and calculations stay live.
 */
export const useMarkupHistory = create<HistoryState>()((set, get) => ({
  byJob: {},

  commit: (jobId, next) => {
    const current = currentMarkups(jobId);
    if (!current || next === current) return;
    const h = get().byJob[jobId] ?? empty;
    set({ byJob: { ...get().byJob, [jobId]: { past: [...h.past, current].slice(-LIMIT), future: [] } } });
    writeMarkups(jobId, next);
  },

  undo: (jobId) => {
    const current = currentMarkups(jobId);
    const h = get().byJob[jobId];
    if (!current || !h?.past.length) return;
    const previous = h.past[h.past.length - 1];
    set({ byJob: { ...get().byJob, [jobId]: { past: h.past.slice(0, -1), future: [current, ...h.future] } } });
    writeMarkups(jobId, previous);
  },

  redo: (jobId) => {
    const current = currentMarkups(jobId);
    const h = get().byJob[jobId];
    if (!current || !h?.future.length) return;
    const [next, ...rest] = h.future;
    set({ byJob: { ...get().byJob, [jobId]: { past: [...h.past, current].slice(-LIMIT), future: rest } } });
    writeMarkups(jobId, next);
  },
}));

export const useCanUndo = (jobId: string) => useMarkupHistory((s) => (s.byJob[jobId]?.past.length ?? 0) > 0);
export const useCanRedo = (jobId: string) => useMarkupHistory((s) => (s.byJob[jobId]?.future.length ?? 0) > 0);

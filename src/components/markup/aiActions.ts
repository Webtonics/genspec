/**
 * AI commands for the Markup studio: read a drawing page, and turn the register's
 * suggestions into draft markups. Kept outside the panel so a read keeps running
 * (and Demo mode can start one) while the panel is closed. Markup changes commit
 * through undo history like any other edit.
 */
import { create } from 'zustand';
import { registerKey, useAiStore } from '@/ai/aiStore';
import { type Skipped, acceptDrafts, planAutoMarkup, removeDrafts } from '@/ai/autoMarkup';
import { readDrawing } from '@/ai/client';
import { isScannedPage, renderPageImages } from '@/ai/renderPage';
import { drawingKey, extractPageSegments, extractPageText, loadPdf } from '@/pdf/pdf';
import type { Markup } from '@/model/types';
import { useJobStore } from '@/store/jobStore';
import { useMarkupHistory } from '@/store/markupHistoryStore';
import { sectionForNewMarkups } from './actions';
import { useStudio } from './studioStore';

export type AiRun = { phase: 'render' | 'read' | 'markup'; started: number } | { phase: 'error'; error: unknown };
export type MarkUpSummary = { added: number; skipped: Skipped[] };

type RunsState = { runs: Record<string, AiRun | undefined>; summaries: Record<string, MarkUpSummary | undefined> };

export const useAiRuns = create<RunsState>()(() => ({ runs: {}, summaries: {} }));

const setRun = (key: string, run: AiRun | undefined) => useAiRuns.setState((s) => ({ runs: { ...s.runs, [key]: run } }));
const getJob = (jobId: string) => useJobStore.getState().jobs.find((j) => j.id === jobId);
const round1 = (n: number) => Math.round(n * 10) / 10;

async function openPage(jobId: string, pageNumber: number) {
  const job = getJob(jobId);
  if (!job?.drawing) throw new Error('This job has no drawing.');
  const doc = await loadPdf(job.drawing);
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const texts = await extractPageText(page).catch(() => []);
  return { job, drawing: job.drawing, page, texts, size: { width: viewport.width, height: viewport.height } };
}

/** The saved register for a job page, if it was read from the drawing now attached. */
function cachedRegister(jobId: string, pageNumber: number) {
  const job = getJob(jobId);
  const entry = useAiStore.getState().registers[registerKey(jobId, pageNumber)];
  return job?.drawing && entry && entry.drawingKey === drawingKey(job.drawing) ? entry : undefined;
}

export const hasRegister = (jobId: string, pageNumber: number) => Boolean(cachedRegister(jobId, pageNumber));

/** Read a page with the AI and save the register. With thenMarkUp, place the drafts straight after. */
export async function readPage(jobId: string, pageNumber: number, o: { thenMarkUp?: boolean } = {}): Promise<void> {
  const key = registerKey(jobId, pageNumber);
  const run = useAiRuns.getState().runs[key];
  if (run && run.phase !== 'error') return;
  const started = Date.now();
  setRun(key, { phase: 'render', started });
  try {
    const { job, drawing, page, texts, size } = await openPage(jobId, pageNumber);
    const images = await renderPageImages(page, isScannedPage(texts));
    setRun(key, { phase: 'read', started });
    const res = await readDrawing({
      images,
      texts: texts.map((t) => ({ str: t.str, x: round1(t.x), y: round1(t.y) })),
      page: size,
      context: { medium: job.medium, code: job.code, sections: job.sections.map((s) => s.name) },
    });
    useAiStore.getState().saveRegister(jobId, {
      drawingKey: drawingKey(drawing),
      page: pageNumber,
      register: res.register,
      model: res.model,
      at: new Date().toISOString(),
    });
    setRun(key, undefined);
    if (o.thenMarkUp) await markUpForMe(jobId, pageNumber);
  } catch (error) {
    setRun(key, { phase: 'error', error });
  }
}

/** Place every open suggestion as an AI draft markup, snapped to the drawing's lines. One undo step. */
export async function markUpForMe(jobId: string, pageNumber: number): Promise<MarkUpSummary | null> {
  const key = registerKey(jobId, pageNumber);
  const entry = cachedRegister(jobId, pageNumber);
  if (!entry) return null;
  setRun(key, { phase: 'markup', started: Date.now() });
  try {
    const { page, texts, size } = await openPage(jobId, pageNumber);
    const segments = await extractPageSegments(page).catch(() => []);
    const job = getJob(jobId);
    if (!job) return null;
    const result = planAutoMarkup({
      register: entry.register,
      texts,
      segments,
      page: pageNumber,
      pageSize: size,
      markups: job.markups,
      sectionId: sectionForNewMarkups(job, useStudio.getState().newSectionId),
    });
    if (result.added.length) useMarkupHistory.getState().commit(jobId, result.markups);
    const summary = { added: result.added.length, skipped: result.skipped };
    useAiRuns.setState((s) => ({ summaries: { ...s.summaries, [key]: summary } }));
    setRun(key, undefined);
    return summary;
  } catch (error) {
    setRun(key, { phase: 'error', error });
    return null;
  }
}

function commitMarkups(jobId: string, fn: (markups: Markup[]) => Markup[]) {
  const job = getJob(jobId);
  if (job) useMarkupHistory.getState().commit(jobId, fn(job.markups));
}

export const acceptDraft = (jobId: string, id: string) => commitMarkups(jobId, (m) => acceptDrafts(m, id));
export const acceptAllDrafts = (jobId: string) => commitMarkups(jobId, (m) => acceptDrafts(m));
export const removeAllDrafts = (jobId: string) => {
  commitMarkups(jobId, (m) => removeDrafts(m));
  useStudio.getState().select(null);
};

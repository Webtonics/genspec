/**
 * Markup studio commands, shared by the overlay, toolbar, keyboard shortcuts and
 * properties panel. Each one reads the latest state and commits through undo history.
 */
import { type DrawingText, nearestTag } from '@/markup/drawingText';
import { dedupePoints } from '@/markup/geometry';
import {
  type MarkupPatch,
  type SymbolType,
  createMarkup,
  deleteMarkup,
  isPolylineType,
  isRotatable,
  nextRotation,
  updateMarkup,
} from '@/markup/ops';
import type { Job, Point } from '@/model/types';
import { useJobStore } from '@/store/jobStore';
import { useMarkupHistory } from '@/store/markupHistoryStore';
import { useStudio } from './studioStore';

const getJob = (jobId: string) => useJobStore.getState().jobs.find((j) => j.id === jobId);
const commit = (jobId: string, next: Job['markups']) => useMarkupHistory.getState().commit(jobId, next);

/** Section new markups are assigned to: the chosen one, else the job's first section. */
export function sectionForNewMarkups(job: Job, choice: string | null | undefined): string | undefined {
  if (choice === null) return undefined;
  if (choice && job.sections.some((s) => s.id === choice)) return choice;
  return job.sections[0]?.id;
}

/**
 * The tag a valve placed here would take from the drawing: the nearest valve tag
 * printed within reach, unless another valve markup already uses it.
 */
export function drawingTagForValve(job: Job, point: Point, texts: DrawingText[]): string | undefined {
  const found = nearestTag(texts, point);
  if (!found) return undefined;
  return job.markups.some((m) => m.type === 'valve' && m.tag.toUpperCase() === found) ? undefined : found;
}

export function placeSymbol(jobId: string, type: SymbolType, point: Point, texts: DrawingText[]) {
  const job = getJob(jobId);
  if (!job) return;
  const studio = useStudio.getState();
  const { markups, markup } = createMarkup(job.markups, {
    type,
    page: studio.pageNumber,
    points: [point],
    sectionId: sectionForNewMarkups(job, studio.newSectionId),
    tag: type === 'valve' ? drawingTagForValve(job, point, texts) : undefined,
  });
  commit(jobId, markups);
  studio.select(markup.id);
}

/** Finish the boundary or purge route being drawn. Needs at least two distinct points. */
export function finishDraft(jobId: string) {
  const studio = useStudio.getState();
  const job = getJob(jobId);
  const points = dedupePoints(studio.draft, 4 / studio.zoom);
  studio.setDraft([]);
  if (!job || !isPolylineType(studio.tool) || points.length < 2) return;
  const { markups, markup } = createMarkup(job.markups, {
    type: studio.tool,
    page: studio.pageNumber,
    points,
    sectionId: sectionForNewMarkups(job, studio.newSectionId),
  });
  commit(jobId, markups);
  studio.select(markup.id);
}

export function updateSelected(jobId: string, patch: MarkupPatch) {
  const job = getJob(jobId);
  const id = useStudio.getState().selectedId;
  if (!job || !id) return;
  commit(jobId, updateMarkup(job.markups, id, patch));
}

export function deleteSelected(jobId: string) {
  const job = getJob(jobId);
  const studio = useStudio.getState();
  if (!job || !studio.selectedId) return;
  commit(jobId, deleteMarkup(job.markups, studio.selectedId));
  studio.select(null);
}

export function rotateSelected(jobId: string) {
  const job = getJob(jobId);
  const id = useStudio.getState().selectedId;
  const markup = job?.markups.find((m) => m.id === id);
  if (!job || !markup || !isRotatable(markup.type)) return;
  commit(jobId, updateMarkup(job.markups, markup.id, { rotation: nextRotation(markup.rotation) }));
}

export function clearAllMarkups(jobId: string) {
  const job = getJob(jobId);
  if (!job || job.markups.length === 0) return;
  commit(jobId, []);
  useStudio.getState().select(null);
}

/** Undo or redo, dropping the selection if the selected markup no longer exists. */
export function stepHistory(jobId: string, direction: 'undo' | 'redo') {
  const history = useMarkupHistory.getState();
  if (direction === 'undo') history.undo(jobId);
  else history.redo(jobId);
  const studio = useStudio.getState();
  if (studio.selectedId && !getJob(jobId)?.markups.some((m) => m.id === studio.selectedId)) studio.select(null);
}

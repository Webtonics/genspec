/**
 * Pure markup operations. Every edit returns a new markups array with tags
 * renumbered, so the studio can commit it to the job and to undo history.
 */
import { uid } from '@/model/factory';
import type { Markup, MarkupType, Point, ValvePosition } from '@/model/types';
import { bounds, roundPoint } from './geometry';
import { retag } from './tags';

export type PolylineType = Extract<MarkupType, 'boundary' | 'purgeRoute'>;
export type SymbolType = Exclude<MarkupType, PolylineType>;

export const isPolylineType = (type: string): type is PolylineType => type === 'boundary' || type === 'purgeRoute';

/** Symbols that sit across a pipe and need turning on vertical lines. */
export const isRotatable = (type: MarkupType) => type === 'valve' || type === 'blind' || type === 'joint';

/** Valves placed for a test boundary isolate it, so they start closed. */
export const DEFAULT_VALVE_POSITION: ValvePosition = 'closed';

export type NewMarkup = {
  type: MarkupType;
  page: number;
  points: Point[];
  sectionId?: string;
  /** A known tag, e.g. read from the drawing. Stored as locked. */
  tag?: string;
  valvePosition?: ValvePosition;
};

export function createMarkup(markups: Markup[], init: NewMarkup): { markups: Markup[]; markup: Markup } {
  const tag = init.tag?.trim();
  const markup: Markup = {
    id: uid('mk'),
    type: init.type,
    page: init.page,
    points: init.points.map(roundPoint),
    tag: tag ?? '',
    ...(tag ? { tagLocked: true } : {}),
    ...(init.sectionId ? { sectionId: init.sectionId } : {}),
    ...(init.type === 'valve' ? { valvePosition: init.valvePosition ?? DEFAULT_VALVE_POSITION } : {}),
  };
  const next = retag([...markups, markup]);
  return { markups: next, markup: next[next.length - 1] };
}

export type MarkupPatch = Partial<Omit<Markup, 'id' | 'type'>>;

/**
 * Apply a patch. Setting a non-empty tag locks it; setting an empty tag hands the
 * markup back to auto numbering.
 */
export function updateMarkup(markups: Markup[], id: string, patch: MarkupPatch): Markup[] {
  const next = markups.map((m) => {
    if (m.id !== id) return m;
    const updated: Markup = { ...m, ...patch };
    if ('tag' in patch) {
      const tag = (patch.tag ?? '').trim();
      updated.tag = tag;
      if (tag) updated.tagLocked = true;
      else delete updated.tagLocked;
    }
    if (patch.points) updated.points = patch.points.map(roundPoint);
    if ('sectionId' in patch && !patch.sectionId) delete updated.sectionId;
    if ('notes' in patch && !patch.notes?.trim()) delete updated.notes;
    return updated;
  });
  return retag(next);
}

export function deleteMarkup(markups: Markup[], id: string): Markup[] {
  return retag(markups.filter((m) => m.id !== id));
}

/** Shift points by a delta, limited so the whole shape stays on the page. */
export function shiftPoints(points: Point[], delta: Point, page: { width: number; height: number }): Point[] {
  const b = bounds(points);
  const dx = Math.min(Math.max(delta.x, -b.minX), page.width - b.maxX);
  const dy = Math.min(Math.max(delta.y, -b.minY), page.height - b.maxY);
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Move a whole markup, keeping every point on the page. */
export function translateMarkup(
  markups: Markup[],
  id: string,
  delta: Point,
  page: { width: number; height: number },
): Markup[] {
  const m = markups.find((x) => x.id === id);
  if (!m) return markups;
  return updateMarkup(markups, id, { points: shiftPoints(m.points, delta, page) });
}

export function moveVertex(markups: Markup[], id: string, index: number, point: Point): Markup[] {
  const m = markups.find((x) => x.id === id);
  if (!m || index < 0 || index >= m.points.length) return markups;
  return updateMarkup(markups, id, { points: m.points.map((p, i) => (i === index ? point : p)) });
}

/** The valve tool toggles between open and closed. Locked positions flip to the opposite plain state. */
export function toggleValvePosition(position: ValvePosition | undefined): ValvePosition {
  return position === 'open' || position === 'locked open' ? 'closed' : 'open';
}

export function nextRotation(rotation: number | undefined): number {
  return ((rotation ?? 0) + 90) % 180;
}

/** Markups grouped by type, in placement order. */
export function groupByType(markups: Markup[]): Map<MarkupType, Markup[]> {
  const groups = new Map<MarkupType, Markup[]>();
  for (const m of markups) groups.set(m.type, [...(groups.get(m.type) ?? []), m]);
  return groups;
}

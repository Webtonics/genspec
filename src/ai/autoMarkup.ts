/**
 * "Mark up for me": turns the AI drawing register's suggestions into draft
 * markups. Each one is placed at its tag, snapped onto the nearest pipe line in
 * the drawing, tagged and numbered like a hand-placed markup, and flagged as an
 * AI draft until an engineer accepts it. Pure, so it is unit tested.
 */
import type { DrawingText } from '@/markup/drawingText';
import { type Segment, type Snap, snapToLine } from '@/markup/lineSnap';
import { createMarkup, deleteMarkup, isRotatable } from '@/markup/ops';
import type { Markup, Point } from '@/model/types';
import { findTagRuns, locateTag, normalizeTag, suggestionViews } from './drawingRegister';
import type { DrawingRegister } from './types';

export type AutoMarkupInput = {
  register: DrawingRegister;
  texts: DrawingText[];
  segments: Segment[];
  page: number;
  pageSize: { width: number; height: number };
  markups: Markup[];
  sectionId?: string;
};

export type Skipped = { label: string; why: string };

export type AutoMarkupResult = { markups: Markup[]; added: Markup[]; skipped: Skipped[] };

/** Markups closer than this are spread along their line so they do not sit on top of each other, points. */
const CROWD = 16;
const SPREAD = [0, 20, -20, 40, -40, 60, -60];
/** Distance a temporary gauge or recorder keeps from the instrument bubble it is placed at, points. */
const INSTRUMENT_CLEARANCE = 18;
/** Margin around the test limits for the boundary cloud, points. */
const BOUNDARY_PAD = 34;

type Candidate = { at: Point; snap: Snap | null; good: boolean };

const segmentLength = (s: Segment) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);

/** A horizontal stroke just under a text run and no wider than it: the run's underline, not a pipe. */
function isUnderlineOf(seg: Segment, run: DrawingText): boolean {
  const half = run.width / 2 + 3;
  const h = Math.max(run.height, 4);
  const inX = (x: number) => x >= run.x - half && x <= run.x + half;
  const inY = (y: number) => y >= run.y && y <= run.y + 1.5 * h;
  return Math.abs(seg.a.y - seg.b.y) < 0.5 && inX(seg.a.x) && inX(seg.b.x) && inY(seg.a.y);
}

const label = (s: { action: string; nearTag: string | null }) => (s.nearTag ? `${s.action} at ${s.nearTag}` : s.action);

export function planAutoMarkup(input: AutoMarkupInput): AutoMarkupResult {
  const { register, texts, segments, page, pageSize, sectionId } = input;
  let markups = input.markups;
  const added: Markup[] = [];
  const skipped: Skipped[] = [];
  const views = suggestionViews(register, texts, markups, page);
  const placed: Point[] = markups.filter((m) => m.page === page && m.points.length === 1).map((m) => m.points[0]);

  /** On its line, moved along it if another markup is already there. */
  const position = (at: Point, snap: Snap | null, clearance = 0): { point: Point; vertical: boolean } => {
    if (!snap) return { point: at, vertical: false };
    const { a, b } = snap.segment;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    for (const shift of SPREAD) {
      const p = { x: snap.point.x + ux * shift, y: snap.point.y + uy * shift };
      const onSegment = (p.x - a.x) * ux + (p.y - a.y) * uy;
      if (onSegment < 0 || onSegment > len) continue;
      if (Math.hypot(p.x - at.x, p.y - at.y) < clearance) continue;
      if (placed.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= CROWD)) return { point: p, vertical: snap.vertical };
    }
    return { point: snap.point, vertical: snap.vertical };
  };

  /**
   * Where a tag could take a markup: each place it is printed, with the line it
   * snaps to (never the tag's own underline). Places on a real run of pipe, longer
   * than the label, come first; titles and callout headers only when nothing else fits.
   */
  const candidates = (tag: string): Candidate[] => {
    const runs = findTagRuns(tag, texts);
    const list: Candidate[] = runs.map((run) => {
      const snap = snapToLine({ x: run.x, y: run.y }, segments.filter((seg) => !isUnderlineOf(seg, run)), pageSize);
      const good = Boolean(snap && segmentLength(snap.segment) >= Math.max(2.5 * run.width, 40));
      return { at: { x: run.x, y: run.y }, snap, good };
    });
    if (!list.length) {
      const at = locateTag(tag, texts);
      if (at) list.push({ at, snap: snapToLine(at, segments, pageSize), good: true });
    }
    const good = list.filter((c) => c.good);
    return good.length ? good : list;
  };
  const used = new Map<string, number>();

  const add = (m: Omit<Parameters<typeof createMarkup>[1], 'page' | 'sectionId'>, extra: Partial<Markup>) => {
    const result = createMarkup(markups, { ...m, page, sectionId });
    const id = result.markup.id;
    markups = result.markups.map((x) => (x.id === id ? { ...x, ...extra, aiDraft: true } : x));
    added.push(markups.find((x) => x.id === id) as Markup);
  };

  const limits: Point[] = [];
  let wantsBoundary: (typeof views)[number] | undefined;

  for (const s of views) {
    if (s.type === 'boundary') {
      wantsBoundary ??= s;
      continue;
    }
    // The n-th suggestion at a repeated label takes the n-th place it is printed.
    const want = s.nearTag ? normalizeTag(s.nearTag) : '';
    const nth = used.get(want) ?? 0;
    used.set(want, nth + 1);
    if (s.done) continue;
    const options = s.nearTag ? candidates(s.nearTag) : [];
    const spot = options[nth] ?? options[0];
    if (!spot) {
      skipped.push({ label: label(s), why: s.nearTag ? 'tag not found in the PDF text' : 'no tag to place it at' });
      continue;
    }
    if (s.type === 'valve' && s.nearTag && markups.some((m) => m.type === 'valve' && normalizeTag(m.tag) === want)) continue;

    // A temporary gauge or recorder goes on the tapping line clear of the drawn instrument bubble.
    const clearance = s.type === 'gauge' || s.type === 'recorder' ? INSTRUMENT_CLEARANCE : 0;
    const { point, vertical } = position(spot.at, spot.snap, clearance);
    placed.push(point);
    const extra: Partial<Markup> = { notes: s.reason };
    if (vertical && isRotatable(s.type)) extra.rotation = 90;
    if (s.type === 'valve') {
      limits.push(point);
      add({ type: 'valve', points: [point], tag: s.nearTag ?? undefined, valvePosition: 'closed' }, extra);
    } else {
      add({ type: s.type, points: [point] }, extra);
    }
  }

  // The boundary: a cloud around the test limit valves (or everything placed), unless one is already drawn.
  if (wantsBoundary && !markups.some((m) => m.page === page && m.type === 'boundary')) {
    const around = limits.length >= 2 ? limits : added.map((m) => m.points[0]);
    if (around.length >= 2) {
      const xs = around.map((p) => p.x);
      const ys = around.map((p) => p.y);
      const clampX = (x: number) => Math.min(Math.max(x, 4), pageSize.width - 4);
      const clampY = (y: number) => Math.min(Math.max(y, 4), pageSize.height - 4);
      let [x0, x1, y0, y1] = [Math.min(...xs) - BOUNDARY_PAD, Math.max(...xs) + BOUNDARY_PAD, Math.min(...ys) - BOUNDARY_PAD, Math.max(...ys) + BOUNDARY_PAD];
      if (y1 - y0 < 90) [y0, y1] = [(y0 + y1) / 2 - 45, (y0 + y1) / 2 + 45];
      if (x1 - x0 < 90) [x0, x1] = [(x0 + x1) / 2 - 45, (x0 + x1) / 2 + 45];
      [x0, x1, y0, y1] = [clampX(x0), clampX(x1), clampY(y0), clampY(y1)];
      add(
        {
          type: 'boundary',
          points: [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
            { x: x1, y: y1 },
            { x: x0, y: y1 },
          ],
        },
        { notes: wantsBoundary.reason },
      );
    } else {
      skipped.push({ label: 'boundary', why: 'not enough located test limits to draw it around' });
    }
  }

  return { markups, added, skipped };
}

export const aiDraftCount = (markups: Markup[]) => markups.filter((m) => m.aiDraft).length;

/** Accept AI drafts (all, or one by id): they become ordinary markups. */
export function acceptDrafts(markups: Markup[], id?: string): Markup[] {
  return markups.map((m) => {
    if (!m.aiDraft || (id && m.id !== id)) return m;
    const next = { ...m };
    delete next.aiDraft;
    return next;
  });
}

/** Remove every AI draft, renumbering what is left. */
export function removeDrafts(markups: Markup[]): Markup[] {
  return markups.filter((m) => m.aiDraft).reduce((list, m) => deleteMarkup(list, m.id), markups);
}

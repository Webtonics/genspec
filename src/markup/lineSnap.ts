/**
 * The drawing's own linework as straight segments in page points (top-left
 * origin), and snapping a point onto the nearest pipe line. Lets AI draft
 * markups land on the pipe beside a tag instead of on the tag text itself.
 */
import type { Point } from '@/model/types';

export type Segment = { a: Point; b: Point };

/** 2D affine matrix [a, b, c, d, e, f], as PDF and pdfjs use. */
export type Matrix = [number, number, number, number, number, number];

/** The pdfjs operator codes this needs (pdfjs-dist 4.x OPS). */
export type PathOps = {
  save: number;
  restore: number;
  transform: number;
  moveTo: number;
  lineTo: number;
  curveTo: number;
  curveTo2: number;
  curveTo3: number;
  closePath: number;
  rectangle: number;
  constructPath: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
};

/** m1 then m2: the transform that applies m1 first. */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

export const apply = (m: Matrix, x: number, y: number): Point => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/**
 * Straight segments from a pdfjs operator list. Curves become their chord, which
 * is enough to snap to. `toPage` maps PDF user space to page points (the page
 * viewport transform at scale 1).
 */
export function segmentsFromOperatorList(fnArray: number[], argsArray: unknown[], ops: PathOps, toPage: Matrix): Segment[] {
  const out: Segment[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const pt = (x: number, y: number) => apply(multiply(ctm, toPage), x, y);
  const push = (a: Point, b: Point) => {
    if (Math.hypot(a.x - b.x, a.y - b.y) > 0.5) out.push({ a, b });
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[] | null;
    if (fn === ops.save) stack.push(ctm);
    else if (fn === ops.restore) ctm = stack.pop() ?? ctm;
    else if (fn === ops.transform && args) ctm = multiply(args as Matrix, ctm);
    else if (fn === ops.paintFormXObjectBegin && args) {
      stack.push(ctm);
      if (Array.isArray(args[0])) ctm = multiply(args[0] as Matrix, ctm);
    } else if (fn === ops.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === ops.constructPath && args) {
      const pathOps = args[0] as number[];
      const c = args[1] as number[];
      let j = 0;
      let start: Point | null = null;
      let cur: Point | null = null;
      for (const op of pathOps) {
        if (op === ops.moveTo) {
          cur = pt(c[j], c[j + 1]);
          start = cur;
          j += 2;
        } else if (op === ops.lineTo) {
          const next = pt(c[j], c[j + 1]);
          if (cur) push(cur, next);
          cur = next;
          j += 2;
        } else if (op === ops.curveTo) {
          const next = pt(c[j + 4], c[j + 5]);
          if (cur) push(cur, next);
          cur = next;
          j += 6;
        } else if (op === ops.curveTo2 || op === ops.curveTo3) {
          const next = pt(c[j + 2], c[j + 3]);
          if (cur) push(cur, next);
          cur = next;
          j += 4;
        } else if (op === ops.closePath) {
          if (cur && start) push(cur, start);
          cur = start;
        } else if (op === ops.rectangle) {
          const [x, y, w, h] = [c[j], c[j + 1], c[j + 2], c[j + 3]];
          const corners = [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
          corners.forEach((p, k) => push(p, corners[(k + 1) % 4]));
          start = cur = corners[0];
          j += 4;
        }
      }
    }
  }
  return out;
}

const length = (s: Segment) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);

/** Closest point on a segment to p. */
export function closestOnSegment(p: Point, s: Segment): Point {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / len2));
  return { x: s.a.x + t * dx, y: s.a.y + t * dy };
}

export type Snap = { point: Point; segment: Segment; distance: number; vertical: boolean };

/**
 * The nearest point on a pipe-like line within `maxDistance` points. Short strokes
 * (symbol details, text underlines, arrowheads) and the sheet frame are ignored.
 */
export function snapToLine(
  p: Point,
  segments: Segment[],
  page: { width: number; height: number },
  o: { maxDistance?: number; minLength?: number } = {},
): Snap | null {
  const maxDistance = o.maxDistance ?? 40;
  const minLength = o.minLength ?? 18;
  let best: Snap | null = null;
  for (const s of segments) {
    const len = length(s);
    if (len < minLength) continue;
    const dx = Math.abs(s.b.x - s.a.x);
    const dy = Math.abs(s.b.y - s.a.y);
    // Sheet frame and grid lines run most of the way across the page.
    if (dx > page.width * 0.7 || dy > page.height * 0.7) continue;
    const q = closestOnSegment(p, s);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= maxDistance && (!best || d < best.distance)) best = { point: q, segment: s, distance: d, vertical: dy > dx };
  }
  return best;
}

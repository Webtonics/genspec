import type { Point } from '@/model/types';

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Stored coordinates are kept to 0.1 pt, plenty for a drawing and compact in storage. */
export function roundPoint(p: Point): Point {
  return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
}

export function clampPoint(p: Point, width: number, height: number): Point {
  return { x: Math.min(Math.max(p.x, 0), width), y: Math.min(Math.max(p.y, 0), height) };
}

/** Drop consecutive points closer than minDistance (a double-click lands twice on the same spot). */
export function dedupePoints(points: Point[], minDistance: number): Point[] {
  return points.reduce<Point[]>((out, p) => {
    const last = out[out.length - 1];
    if (!last || distance(last, p) >= minDistance) out.push(p);
    return out;
  }, []);
}

/** Shoelace area in y-down page coordinates: positive when the points run clockwise on screen. */
export function signedArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return sum / 2;
}

export function polylinePath(points: Point[], closed = false): string {
  if (points.length === 0) return '';
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(p.x)} ${r2(p.y)}`).join(' ');
  return closed ? `${d} Z` : d;
}

/**
 * Revision cloud along a polyline: each edge becomes a row of arcs about
 * arcLength long. Closed shapes bulge outward whichever way they were drawn.
 */
export function cloudPath(points: Point[], closed: boolean, arcLength = 12): string {
  if (points.length < 2) return '';
  const pts = closed ? [...points, points[0]] : points;
  const sweep = closed ? (signedArea(points) >= 0 ? 1 : 0) : 1;
  let d = `M ${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = distance(a, b);
    if (len < 0.01) continue;
    const n = Math.max(1, Math.round(len / arcLength));
    const radius = r2((len / n) * 0.6);
    for (let k = 1; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n;
      const y = a.y + ((b.y - a.y) * k) / n;
      d += ` A ${radius} ${radius} 0 0 ${sweep} ${r2(x)} ${r2(y)}`;
    }
  }
  return closed ? `${d} Z` : d;
}

export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/** The point a fraction t (0 to 1) of the way along a polyline, and the direction of travel there in radians. */
export function pointAlong(points: Point[], t: number): { point: Point; angle: number } {
  if (points.length === 1) return { point: points[0], angle: 0 };
  const target = polylineLength(points) * Math.min(Math.max(t, 0), 1);
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = distance(a, b);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (walked + len >= target || i === points.length - 1) {
      const f = len === 0 ? 0 : Math.min((target - walked) / len, 1);
      return { point: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, angle };
    }
    walked += len;
  }
  return { point: points[points.length - 1], angle: 0 };
}

export function bounds(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

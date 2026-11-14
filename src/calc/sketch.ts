/**
 * Geometry of the schematic elevation sketch, shared by the Calculations page
 * and the test pack PDF. Not to scale: only the high and low points are known.
 */
export type SketchPt = [number, number];

/** Profile shape as (fraction along, fraction of height from low to high point). */
const PROFILE: SketchPt[] = [
  [0, 0.4],
  [0.2, 0.62],
  [0.42, 1],
  [0.62, 0.42],
  [0.8, 0],
  [1, 0.22],
];
export const HIGH_INDEX = 2;
export const LOW_INDEX = 4;

/** Profile points across x0 to x1, with the high point at yHigh and the low point at yLow. */
export function sketchPoints(x0: number, x1: number, yHigh: number, yLow: number): SketchPt[] {
  return PROFILE.map(([fx, t]) => [x0 + fx * (x1 - x0), yLow - t * (yLow - yHigh)]);
}

/** Smooth curve through the points, with flat tangents at the high and low points so they stay the extremes. */
export function smoothPath(p: SketchPt[], flatAt: number[] = [HIGH_INDEX, LOW_INDEX]): string {
  const n = p.length;
  const tangent = (i: number): SketchPt => {
    const a = p[Math.max(i - 1, 0)];
    const b = p[Math.min(i + 1, n - 1)];
    return flatAt.includes(i) ? [(b[0] - a[0]) / 2, 0] : [(b[0] - a[0]) / 2, (b[1] - a[1]) / 2];
  };
  const r = (v: number) => Math.round(v * 100) / 100;
  let d = `M ${r(p[0][0])} ${r(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const t1 = tangent(i);
    const t2 = tangent(i + 1);
    d += ` C ${r(p[i][0] + t1[0] / 3)} ${r(p[i][1] + t1[1] / 3)} ${r(p[i + 1][0] - t2[0] / 3)} ${r(p[i + 1][1] - t2[1] / 3)} ${r(p[i + 1][0])} ${r(p[i + 1][1])}`;
  }
  return d;
}

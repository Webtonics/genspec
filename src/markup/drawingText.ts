import type { Point } from '@/model/types';

/** A text run on the drawing, centred at (x, y) in page points from the top-left. */
export type DrawingText = { str: string; x: number; y: number; width: number; height: number };

/** Valve tags as drawn on P&IDs: MV-101, KV-101, XV-2001, SDV-12, ESDV-301A, PSV-101... */
export const VALVE_TAG_PATTERN = /^[A-Z]{0,4}V-\d{1,4}[A-Z]?$/;

/**
 * The tag nearest to a point that matches the pattern, within maxDistance points.
 * Lets the valve tool pick up the client's own tag when placed on a drawn valve.
 */
export function nearestTag(
  texts: DrawingText[],
  point: Point,
  pattern: RegExp = VALVE_TAG_PATTERN,
  maxDistance = 40,
): string | undefined {
  let best: string | undefined;
  let bestDistance = maxDistance;
  for (const t of texts) {
    const str = t.str.trim().toUpperCase();
    if (!pattern.test(str)) continue;
    const d = Math.hypot(t.x - point.x, t.y - point.y);
    if (d <= bestDistance) {
      best = str;
      bestDistance = d;
    }
  }
  return best;
}

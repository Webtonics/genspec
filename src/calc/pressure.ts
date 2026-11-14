export type Flag = 'RED' | 'AMBER' | 'GREEN';

/** Tolerance for comparing pressures at the flag boundaries, so 95.0% is not lost to rounding. */
const EPS = 1e-9;

/** Static head (bar) = gradient (bar/m) x elevation difference (m). 0.0981 bar/m for water at 1000 kg/m3. */
export function staticHeadBar(elevationDiffM: number, gradientBarPerM: number): number {
  return gradientBarPerM * elevationDiffM;
}

/** Minimum test pressure at the high point (barg) = factor x design pressure. */
export function highPointTestPressureBarg(designBarg: number, factor: number): number {
  return factor * designBarg;
}

/** Test pressure at the low point (barg) = high point pressure + static head. */
export function lowPointTestPressureBarg(highPointBarg: number, headBar: number): number {
  return highPointBarg + headBar;
}

/** The pressure from which the low point counts as "within" amberWithinPct of the max allowable. */
export function amberThresholdBarg(maxAllowableBarg: number, amberWithinPct: number): number {
  return maxAllowableBarg * (1 - amberWithinPct / 100);
}

/** RED if the low point exceeds the max allowable, AMBER if within amberWithinPct of it, else GREEN. */
export function pressureFlag(lowPointBarg: number, maxAllowableBarg: number, amberWithinPct: number): Flag {
  if (lowPointBarg > maxAllowableBarg + EPS) return 'RED';
  if (lowPointBarg >= amberThresholdBarg(maxAllowableBarg, amberWithinPct) - EPS) return 'AMBER';
  return 'GREEN';
}

const SEVERITY: Record<Flag, number> = { GREEN: 0, AMBER: 1, RED: 2 };

/** The most severe of a set of flags, or null for none. */
export function worstFlag(flags: Array<Flag | null | undefined>): Flag | null {
  return flags.reduce<Flag | null>(
    (worst, f) => (f && (!worst || SEVERITY[f] > SEVERITY[worst]) ? f : worst),
    null,
  );
}

import type { SectionCalc } from '@/calc';
import { HIGH_INDEX, LOW_INDEX, sketchPoints, smoothPath } from '@/calc/sketch';
import { cx } from '@/lib/cx';
import { fmtNumber } from '@/lib/format';
import type { TestSection } from '@/model/types';
import { FLAG_FILL } from '../ui/FlagChip';

// Sketch geometry (SVG units). Not to scale: only the high and low points are known.
const W = 460;
const H = 250;
const X0 = 24;
const X1 = 320;
const Y_HIGH = 72;
const Y_LOW = 170;
const Y_GROUND = 226;
const DIM_X = 362;


const elevation = (m: number) => `EL ${m >= 0 ? '+' : ''}${fmtNumber(m, 1)} m`;

/** Schematic pipeline profile with the high and low points, their test pressures and the static head between them. */
export function ElevationSketch({ section, calc, isWater }: { section: TestSection; calc: SectionCalc; isWater: boolean }) {
  const { highPointElevM: hp, lowPointElevM: lp } = section;
  const { highPointBarg, lowPointBarg, staticHeadBar, elevationDiffM } = calc.values;

  if (!Number.isFinite(hp) || !Number.isFinite(lp) || hp < lp) {
    return (
      <figure className="grid h-48 place-items-center rounded-lg border border-dashed border-line-strong bg-sheet px-6 text-center text-sm text-muted">
        Enter a high point at or above the low point in Job setup to draw the elevation sketch.
      </figure>
    );
  }

  const pts = sketchPoints(X0, X1, Y_HIGH, Y_LOW);
  const [hx, hy] = pts[HIGH_INDEX];
  const [lx, ly] = pts[LOW_INDEX];
  const profile = smoothPath(pts);
  const ground = `${profile} L ${X1} ${Y_GROUND} L ${X0} ${Y_GROUND} Z`;
  const mid = (hy + ly) / 2;
  const lowFill = calc.flag ? FLAG_FILL[calc.flag.flag] : 'fill-sheet-text';

  const headText = !isWater
    ? 'head ≈ 0 (gas)'
    : staticHeadBar !== undefined
      ? `+${fmtNumber(staticHeadBar, 2)} bar head`
      : '';

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-sheet">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Elevation sketch for ${section.name}: high point ${elevation(hp)}, low point ${elevation(lp)}`}
        fontFamily="inherit"
      >
        <path d={ground} className="fill-sheet-grid" opacity={0.55} />
        <path d={profile} fill="none" className="stroke-sheet-line" strokeWidth={3} strokeLinecap="round" />

        {/* Static head dimension */}
        <g className="stroke-instrument" strokeWidth={1}>
          <line x1={hx + 8} y1={hy} x2={DIM_X + 6} y2={hy} strokeDasharray="3 3" />
          <line x1={lx + 8} y1={ly} x2={DIM_X + 6} y2={ly} strokeDasharray="3 3" />
          <line x1={DIM_X} y1={hy + 6} x2={DIM_X} y2={ly - 6} strokeWidth={1.4} />
        </g>
        <polygon points={`${DIM_X},${hy} ${DIM_X - 4},${hy + 8} ${DIM_X + 4},${hy + 8}`} className="fill-instrument" />
        <polygon points={`${DIM_X},${ly} ${DIM_X - 4},${ly - 8} ${DIM_X + 4},${ly - 8}`} className="fill-instrument" />
        <text x={DIM_X + 10} y={mid - 4} fontSize={11} fontWeight={600} className="fill-sheet-text">
          Δh {fmtNumber(elevationDiffM ?? hp - lp, 1)} m
        </text>
        <text x={DIM_X + 10} y={mid + 11} fontSize={10.5} className="fill-instrument">
          {headText}
        </text>

        {/* High point */}
        <circle cx={hx} cy={hy} r={5} strokeWidth={2} className="fill-sheet stroke-instrument" />
        <text x={hx} y={hy - 32} textAnchor="middle" fontSize={10} fontWeight={600} letterSpacing={0.4} className="fill-sheet-text">
          HIGH POINT, {elevation(hp)}
        </text>
        <text x={hx} y={hy - 15} textAnchor="middle" fontSize={12.5} fontWeight={700} className="fill-instrument">
          {highPointBarg !== undefined ? `P(HP) ${fmtNumber(highPointBarg, 2)} barg` : 'P(HP) not calculated'}
        </text>

        {/* Low point */}
        <circle cx={lx} cy={ly} r={5} strokeWidth={2} className="fill-sheet stroke-instrument" />
        <text x={lx} y={ly + 23} textAnchor="middle" fontSize={10} fontWeight={600} letterSpacing={0.4} className="fill-sheet-text">
          LOW POINT, {elevation(lp)}
        </text>
        <text x={lx} y={ly + 40} textAnchor="middle" fontSize={12.5} fontWeight={700} className={cx(lowFill)}>
          {lowPointBarg !== undefined ? `P(LP) ${fmtNumber(lowPointBarg, 2)} barg` : 'P(LP) not calculated'}
        </text>

        <text x={12} y={H - 9} fontSize={9.5} opacity={0.7} className="fill-sheet-text">
          {section.name} elevation sketch, not to scale
        </text>
      </svg>
    </figure>
  );
}

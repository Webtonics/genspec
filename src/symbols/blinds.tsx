/** Line blinds, drawn across a horizontal line at the origin. */
import { type Placement, placement, usePalette } from './palette';

/** Spectacle blind: solid blank in the line, open spacer ring beside it. */
export function SpectacleBlind(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <line x1={0} y1={0} x2={0} y2={-13} stroke={p.line} strokeWidth={1.8} />
      <circle cx={0} cy={-13} r={5} fill={p.fill} stroke={p.line} strokeWidth={1.8} />
      <circle cx={0} cy={0} r={5.6} fill={p.line} />
    </g>
  );
}

/** Spade (paddle blind) with its handle. */
export function Spade(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <rect x={-1.6} y={-19} width={3.2} height={14} fill={p.line} />
      <circle cx={0} cy={0} r={6} fill={p.line} />
    </g>
  );
}

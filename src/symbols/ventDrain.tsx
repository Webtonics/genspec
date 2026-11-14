/** Vent and drain connections. Origin is the connection on the line. */
import { type Placement, placement, usePalette } from './palette';

export function Vent(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1={0} y1={0} x2={0} y2={-24} strokeWidth={2} />
      <path d="M -6.5 -16 L 0 -25 L 6.5 -16" strokeWidth={2} />
    </g>
  );
}

export function Drain(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <line x1={0} y1={0} x2={0} y2={18} strokeWidth={2} />
      <path d="M -7.5 18 L 7.5 18 L 0 27 Z" fill={p.fill} strokeWidth={1.8} />
    </g>
  );
}

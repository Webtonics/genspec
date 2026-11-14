/** Valve symbols, drawn on a horizontal line through the origin, flow left to right. */
import { type Placement, placement, usePalette } from './palette';

const BOWTIE = 'M -12 -8 L -12 8 L 0 0 Z M 12 -8 L 12 8 L 0 0 Z';

export function GateValve({ closed, ...at }: Placement & { closed?: boolean }) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <path d={BOWTIE} fill={closed ? p.line : p.fill} stroke={p.line} strokeWidth={2} strokeLinejoin="round" />
    </g>
  );
}

export function BallValve({ closed, ...at }: Placement & { closed?: boolean }) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <path d={BOWTIE} fill={closed ? p.line : p.fill} stroke={p.line} strokeWidth={2} strokeLinejoin="round" />
      <circle r={4.6} fill={p.fill} stroke={p.line} strokeWidth={1.7} />
    </g>
  );
}

export function GlobeValve(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <path d={BOWTIE} fill={p.fill} stroke={p.line} strokeWidth={2} strokeLinejoin="round" />
      <circle r={4} fill={p.line} />
    </g>
  );
}

/** Non-return valve: solid triangle against a seat bar, pointing with the flow. */
export function CheckValve(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <path d="M -11 -8 L -11 8 L 7 0 Z" fill={p.line} stroke={p.line} strokeWidth={1.6} strokeLinejoin="round" />
      <line x1={9} y1={-9} x2={9} y2={9} stroke={p.line} strokeWidth={2.6} />
    </g>
  );
}

/** Angle pattern relief valve. Origin is the inlet on top of the line; the body sits above it. */
export function ReliefValve(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <line x1={0} y1={0} x2={0} y2={-20} strokeWidth={2} />
      <path d="M 0 -32 L -3.5 -35.5 L 3.5 -39 L -3.5 -42.5 L 3.5 -46 L 0 -48" fill="none" strokeWidth={1.4} />
      <path d="M -6.5 -20 L 6.5 -20 L 0 -32 Z" fill={p.fill} strokeWidth={1.8} />
      <path d="M 12 -38.5 L 12 -25.5 L 0 -32 Z" fill={p.fill} strokeWidth={1.8} />
      <line x1={12} y1={-32} x2={24} y2={-32} strokeWidth={2} />
    </g>
  );
}

/**
 * Equipment symbols. Each sits on a horizontal process line through its origin,
 * with its inlet on the left and outlet on the right.
 */
import { type Placement, placement, usePalette } from './palette';

const FEET = 'M -15 17 L -21 29 L 21 29 L 15 17';

/** Centrifugal pump: casing with the flow triangle and base. Ports at x = -22 and 22. */
export function CentrifugalPump(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <path d={FEET} fill="none" strokeWidth={1.8} />
      <circle r={22} fill={p.fill} strokeWidth={2.2} />
      <path d="M -8 -11 L 13 0 L -8 11 Z" fill="none" strokeWidth={1.8} />
    </g>
  );
}

/** Positive displacement (reciprocating) pump, e.g. the hydrotest pressure pump. */
export function PositiveDisplacementPump(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <path d={FEET} fill="none" strokeWidth={1.8} />
      <circle r={22} fill={p.fill} strokeWidth={2.2} />
      <rect x={-9} y={-9} width={18} height={18} fill="none" strokeWidth={1.8} />
      <line x1={-9} y1={0} x2={9} y2={0} strokeWidth={1.4} />
    </g>
  );
}

/** Compressor: casing with converging lines, wide at the inlet. Ports at x = -24 and 24. */
export function Compressor(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <path d={FEET} fill="none" strokeWidth={1.8} />
      <circle r={24} fill={p.fill} strokeWidth={2.2} />
      <path d="M -17 -17 L 17 -8 M -17 17 L 17 8" fill="none" strokeWidth={1.8} />
    </g>
  );
}

/** Nitrogen pumper or membrane unit, skid with vaporiser coil. Outlet at x = 48. */
export function NitrogenUnit(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <rect x={-48} y={-32} width={96} height={64} rx={6} fill={p.fill} stroke={p.line} strokeWidth={2.2} />
      <text x={-20} y={7} textAnchor="middle" fontSize={20} fontWeight={700} fill={p.text}>
        N
        <tspan fontSize={13} dy={5}>
          2
        </tspan>
      </text>
      <path
        d="M 8 -18 L 34 -12 L 8 -6 L 34 0 L 8 6 L 34 12 L 8 18"
        fill="none"
        stroke={p.line}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Pig launcher: closure, barrel with a pig loaded, reducer to the line. Ports at x = -48 and 48. */
export function PigLauncher(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <line x1={-48} y1={0} x2={-42} y2={0} strokeWidth={2.4} />
      <line x1={-42} y1={-21} x2={-42} y2={21} strokeWidth={4} />
      <rect x={-38} y={-16} width={60} height={32} fill={p.fill} strokeWidth={2.2} />
      <rect x={-30} y={-9} width={22} height={18} rx={8} fill={p.muted} stroke="none" opacity={0.55} />
      <path d="M 22 -16 L 38 -6 L 38 6 L 22 16 Z" fill={p.fill} strokeWidth={2.2} />
      <line x1={38} y1={0} x2={48} y2={0} strokeWidth={2.4} />
    </g>
  );
}

/** Pig receiver: the launcher mirrored. Ports at x = -48 and 48. */
export function PigReceiver(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <line x1={-48} y1={0} x2={-38} y2={0} strokeWidth={2.4} />
      <path d="M -38 -6 L -22 -16 L -22 16 L -38 6 Z" fill={p.fill} strokeWidth={2.2} />
      <rect x={-22} y={-16} width={60} height={32} fill={p.fill} strokeWidth={2.2} />
      <line x1={42} y1={-21} x2={42} y2={21} strokeWidth={4} />
      <line x1={42} y1={0} x2={48} y2={0} strokeWidth={2.4} />
    </g>
  );
}

/** Vertical tank above the line with its outlet nozzle on the right. Outlet at x = 34. */
export function Tank(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <path d="M -32 8 L -32 -72 Q 0 -92 32 -72 L 32 8 Z" fill={p.fill} strokeWidth={2.2} />
      <line x1={-32} y1={-72} x2={32} y2={-72} strokeWidth={1.2} opacity={0.6} />
      <line x1={32} y1={0} x2={34} y2={0} strokeWidth={2.4} />
    </g>
  );
}

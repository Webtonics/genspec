/** Flow arrows, revision cloud, flow meter, off-page connector, vent stack and injection point. */
import { cloudPath } from '@/markup/geometry';
import { type Placement, placement, usePalette } from './palette';

export type Direction = 'right' | 'left' | 'up' | 'down';
const ROTATION: Record<Direction, number> = { right: 0, down: 90, left: 180, up: 270 };

export function FlowArrow({ direction = 'right', ...at }: Placement & { direction?: Direction }) {
  const p = usePalette();
  return (
    <g transform={placement({ ...at, rotate: ROTATION[direction] })}>
      <path d="M 7 0 L -6 -5.5 L -6 5.5 Z" fill={p.line} />
    </g>
  );
}

/** Revision cloud around a rectangle centred on the origin. */
export function Cloud({ width, height, ...at }: Placement & { width: number; height: number }) {
  const p = usePalette();
  const w = width / 2;
  const h = height / 2;
  const d = cloudPath(
    [
      { x: -w, y: -h },
      { x: w, y: -h },
      { x: w, y: h },
      { x: -w, y: h },
    ],
    true,
    16,
  );
  return (
    <g transform={placement(at)}>
      <path d={d} fill={p.accent} fillOpacity={0.05} stroke={p.accent} strokeWidth={2} strokeLinejoin="round" />
    </g>
  );
}

/** In-line flow meter body. Ports at x = -16 and 16. */
export function FlowMeter(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line}>
      <rect x={-16} y={-11} width={32} height={22} fill={p.fill} strokeWidth={2} />
      <circle r={6.5} fill="none" strokeWidth={1.6} />
      <line x1={-4.6} y1={4.6} x2={4.6} y2={-4.6} strokeWidth={1.6} />
    </g>
  );
}

/** Off-page connector pointing right, from the origin. Optional text inside. */
export function OffPageConnector({ text, ...at }: Placement & { text?: string }) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <path d="M 0 -16 L 54 -16 L 70 0 L 54 16 L 0 16 Z" fill={p.fill} stroke={p.line} strokeWidth={2} strokeLinejoin="round" />
      {text && (
        <text x={29} y={4} textAnchor="middle" fontSize={10} fontWeight={700} fill={p.text}>
          {text}
        </text>
      )}
    </g>
  );
}

/** Vent stack to a safe location, with rain cap. Inlet at the origin, rises on the right. */
export function VentStack(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M 0 0 L 24 0 L 24 -60" strokeWidth={2.6} />
      <path d="M 10 -66 Q 24 -78 38 -66" strokeWidth={2} />
      <line x1={24} y1={-60} x2={24} y2={-66} strokeWidth={1.4} />
    </g>
  );
}

/** Chemical injection: small dosing pump above the line feeding down into it. */
export function InjectionPoint(at: Placement) {
  const p = usePalette();
  return (
    <g transform={placement(at)} stroke={p.line} strokeLinejoin="round">
      <line x1={0} y1={0} x2={0} y2={-36} strokeWidth={2} />
      <circle cx={0} cy={-49} r={13} fill={p.fill} strokeWidth={2} />
      <path d="M -5 -55.5 L 7.5 -49 L -5 -42.5 Z" fill="none" strokeWidth={1.5} />
      <circle cx={0} cy={0} r={2.6} fill={p.line} stroke="none" />
    </g>
  );
}

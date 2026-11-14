/** ISA-5.1 style instrument bubble: circle with function letters over the loop number. */
import { type Placement, placement, usePalette } from './palette';

export const BUBBLE_RADIUS = 15;

export function InstrumentBubble({
  letters,
  number,
  panel,
  ...at
}: Placement & {
  letters: string;
  number: string;
  /** Control room mounted: horizontal line through the bubble. Field mounted when false. */
  panel?: boolean;
}) {
  const p = usePalette();
  return (
    <g transform={placement(at)}>
      <circle r={BUBBLE_RADIUS} fill={p.fill} stroke={p.instrument} strokeWidth={1.8} />
      {panel && <line x1={-BUBBLE_RADIUS} y1={0} x2={BUBBLE_RADIUS} y2={0} stroke={p.instrument} strokeWidth={1.2} />}
      <text y={number ? -1.5 : 3.5} textAnchor="middle" fontSize={letters.length > 3 ? 8.5 : 10} fontWeight={700} fill={p.instrument}>
        {letters}
      </text>
      {number && (
        <text y={10} textAnchor="middle" fontSize={9} fill={p.instrument}>
          {number}
        </text>
      )}
    </g>
  );
}

/**
 * How each markup type is drawn, in PDF points around its anchor point. Colours
 * come from the theme tokens: markup red (amber in SCADA), temporary instruments
 * blue (cyan in SCADA), so the overlay follows the display mode.
 */
import type { ReactNode } from 'react';
import { cloudPath, polylinePath, pointAlong } from '@/markup/geometry';
import type { SymbolType } from '@/markup/ops';
import {
  SYMBOL_BOX,
  isClosed,
  labelPlacement,
  positionAbbrev,
  positionPlacement,
  splitInstrumentTag,
} from '@/markup/symbols';
import type { Markup, MarkupType, Point, ValvePosition } from '@/model/types';

export { SYMBOL_BOX, positionAbbrev };

const STROKE = 1.6;

/** Tag text with a halo in the sheet colour so it reads over drawing linework. */
export function TagText({
  x,
  y,
  anchor = 'start',
  size = 7,
  className = 'fill-markup',
  children,
}: {
  x: number;
  y: number;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={700}
      className={`${className} stroke-sheet`}
      strokeWidth={2.3}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ userSelect: 'none' }}
    >
      {children}
    </text>
  );
}

/** The symbol itself, centred on (0, 0), before rotation. */
export function SymbolShape({ type, valvePosition }: { type: SymbolType; valvePosition?: ValvePosition }) {
  switch (type) {
    case 'blind':
      // Spectacle blind: solid blank on the line, open spacer ring beside it.
      return (
        <>
          <line x1={0} y1={0} x2={0} y2={-11} className="stroke-markup" strokeWidth={STROKE} />
          <circle cx={0} cy={-11} r={4.2} className="fill-sheet stroke-markup" strokeWidth={STROKE} />
          <circle cx={0} cy={0} r={4.6} className="fill-markup" />
        </>
      );
    case 'vent':
      return (
        <>
          <circle cx={0} cy={0} r={2} className="fill-markup" />
          <line x1={0} y1={0} x2={0} y2={-15} className="stroke-markup" strokeWidth={STROKE} />
          <path
            d="M -5 -9.5 L 0 -16 L 5 -9.5"
            fill="none"
            className="stroke-markup"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'drain':
      return (
        <>
          <circle cx={0} cy={0} r={2} className="fill-markup" />
          <line x1={0} y1={0} x2={0} y2={10} className="stroke-markup" strokeWidth={STROKE} />
          <path d="M -6 10 L 6 10 L 0 17.5 Z" className="fill-sheet stroke-markup" strokeWidth={1.5} strokeLinejoin="round" />
        </>
      );
    case 'fill':
      // Hose connection with the flow arrow pointing into the line.
      return (
        <>
          <circle cx={-14} cy={-14} r={3.6} className="fill-sheet stroke-markup" strokeWidth={1.5} />
          <line x1={-11.4} y1={-11.4} x2={-4} y2={-4} className="stroke-markup" strokeWidth={STROKE} />
          <path d="M 0 0 L -7 -2.6 L -2.6 -7 Z" className="fill-markup" />
        </>
      );
    case 'gauge':
    case 'recorder':
      return (
        <>
          <line x1={0} y1={0} x2={0} y2={-9} className="stroke-instrument" strokeWidth={1.2} />
          <circle cx={0} cy={-18.5} r={9.5} className="fill-sheet stroke-instrument" strokeWidth={1.4} />
          {type === 'recorder' && (
            <path d="M -5.5 -9.6 L 5.5 -9.6" className="stroke-instrument" strokeWidth={1.2} strokeLinecap="round" />
          )}
        </>
      );
    case 'valve':
      return (
        <path
          d="M -10 -6.5 L -10 6.5 L 0 0 Z M 10 -6.5 L 10 6.5 L 0 0 Z"
          className={isClosed(valvePosition) ? 'fill-markup stroke-markup' : 'fill-sheet stroke-markup'}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      );
    case 'joint':
      return (
        <>
          <line x1={-2.6} y1={-8} x2={-2.6} y2={8} className="stroke-markup" strokeWidth={2.2} />
          <line x1={2.6} y1={-8} x2={2.6} y2={8} className="stroke-markup" strokeWidth={2.2} />
        </>
      );
  }
}

/** A complete symbol markup (shape, tag, valve state) at its point. */
export function SymbolGlyph({
  type,
  tag,
  valvePosition,
  rotation = 0,
  point,
  showLabel = true,
  children,
}: {
  type: SymbolType;
  tag: string;
  valvePosition?: ValvePosition;
  rotation?: number;
  point: Point;
  showLabel?: boolean;
  /** Extra layers drawn under the symbol, e.g. hover and selection. */
  children?: ReactNode;
}) {
  const label = labelPlacement(type, rotation);
  const pos = positionPlacement(rotation);
  const [letters, number] = splitInstrumentTag(tag);
  return (
    <g transform={`translate(${point.x} ${point.y})`}>
      {children}
      <g transform={rotation ? `rotate(${rotation})` : undefined}>
        <SymbolShape type={type} valvePosition={valvePosition} />
      </g>
      {(type === 'gauge' || type === 'recorder') && (
        <g className="fill-instrument" textAnchor="middle" fontWeight={700} style={{ userSelect: 'none' }}>
          <text x={0} y={number ? -19.8 : -16.2} fontSize={number ? 6.6 : 7}>
            {letters}
          </text>
          {number && (
            <text x={0} y={-12.6} fontSize={5.6} fontWeight={600}>
              {number}
            </text>
          )}
        </g>
      )}
      {showLabel && label && tag && (
        <TagText x={label.x} y={label.y} anchor={label.anchor}>
          {tag}
        </TagText>
      )}
      {showLabel && type === 'valve' && (
        <TagText x={pos.x} y={pos.y} anchor={pos.anchor} size={5.6}>
          {positionAbbrev(valvePosition)}
        </TagText>
      )}
    </g>
  );
}

/** Test boundary: red revision cloud, closed and lightly tinted once it has three or more points. */
export function BoundaryGlyph({ points, label }: { points: Point[]; label?: string }) {
  const closed = points.length >= 3;
  const top = points.reduce((best, p) => (p.y < best.y ? p : best), points[0]);
  return (
    <g>
      <path
        d={cloudPath(points, closed)}
        className="fill-markup stroke-markup"
        fillOpacity={closed ? 0.045 : 0}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {label && (
        <TagText x={top.x} y={top.y - 9} size={8}>
          {label}
        </TagText>
      )}
    </g>
  );
}

/** Purge route: highlighter band under a dashed line, with an arrow showing the flow direction. */
export function PurgeRouteGlyph({ points, label }: { points: Point[]; label?: string }) {
  if (points.length < 2) return null;
  const d = polylinePath(points);
  const end = pointAlong(points, 1);
  const mid = pointAlong(points, 0.5);
  const a = end.angle;
  const tip = end.point;
  const back = { x: tip.x - Math.cos(a) * 9, y: tip.y - Math.sin(a) * 9 };
  const nx = -Math.sin(a) * 4.5;
  const ny = Math.cos(a) * 4.5;
  return (
    <g>
      <path d={d} fill="none" className="stroke-highlight" strokeOpacity={0.45} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" className="stroke-markup" strokeWidth={1.6} strokeDasharray="6 4" strokeLinejoin="round" />
      <polygon
        points={`${tip.x},${tip.y} ${back.x + nx},${back.y + ny} ${back.x - nx},${back.y - ny}`}
        className="fill-markup"
      />
      {label && (
        <TagText x={mid.point.x} y={mid.point.y - 9} anchor="middle" size={7.5}>
          {label}
        </TagText>
      )}
    </g>
  );
}

/** Stand-alone icon of a markup type, for the toolbar, panel and legend. */
export function MarkupIcon({ type, className = 'size-6' }: { type: MarkupType; className?: string }) {
  if (type === 'boundary') {
    const pts = [
      { x: 6, y: 9 },
      { x: 26, y: 9 },
      { x: 26, y: 23 },
      { x: 6, y: 23 },
    ];
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden>
        <path d={cloudPath(pts, true, 5)} className="fill-markup stroke-markup" fillOpacity={0.08} strokeWidth={1.7} />
      </svg>
    );
  }
  if (type === 'purgeRoute') {
    const d = 'M 4 25 L 13 12 L 26 12';
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden>
        <path d={d} fill="none" className="stroke-highlight" strokeOpacity={0.5} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" className="stroke-markup" strokeWidth={1.7} strokeDasharray="4 2.5" />
        <path d="M 29 12 L 23.5 9 L 23.5 15 Z" className="fill-markup" />
      </svg>
    );
  }
  const [x, y, w, h] = SYMBOL_BOX[type];
  const size = Math.max(w, h) + 5;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tag = type === 'gauge' ? 'PI' : type === 'recorder' ? 'PR' : '';
  return (
    <svg viewBox={`${cx - size / 2} ${cy - size / 2} ${size} ${size}`} className={className} aria-hidden>
      <SymbolGlyph type={type} tag={tag} valvePosition="closed" point={{ x: 0, y: 0 }} showLabel={false} />
    </svg>
  );
}

/** Markup ready to draw: symbol, boundary or purge route. */
export function MarkupGlyph({ markup, sectionName }: { markup: Markup; sectionName?: string }) {
  if (markup.type === 'boundary') {
    return <BoundaryGlyph points={markup.points} label={sectionName ? `${markup.tag} · ${sectionName}` : markup.tag} />;
  }
  if (markup.type === 'purgeRoute') return <PurgeRouteGlyph points={markup.points} label={markup.tag} />;
  return (
    <SymbolGlyph
      type={markup.type}
      tag={markup.tag}
      valvePosition={markup.valvePosition}
      rotation={markup.rotation}
      point={markup.points[0]}
    />
  );
}

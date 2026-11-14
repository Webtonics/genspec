/**
 * Markup symbol geometry shared by the on-screen overlay and the PDF export, so
 * a markup prints exactly where and how it appears in the Markup studio.
 * All values are PDF points around the symbol's anchor point.
 */
import type { Markup, ValvePosition } from '@/model/types';
import { bounds } from './geometry';
import { type SymbolType, isPolylineType } from './ops';

/** Symbol extent around its anchor: [x, y, width, height]. Used for hit areas, selection and revision clouds. */
export const SYMBOL_BOX: Record<SymbolType, [number, number, number, number]> = {
  blind: [-6.5, -17, 13, 23],
  vent: [-7, -18, 14, 21],
  drain: [-7.5, -3, 15, 22],
  fill: [-19, -19, 21.5, 21.5],
  gauge: [-11, -29.5, 22, 31.5],
  recorder: [-11, -29.5, 22, 31.5],
  valve: [-11.5, -8, 23, 16],
  joint: [-5.5, -9.5, 11, 19],
};

/** Symbol box after rotation (0 or 90 degrees), still relative to the anchor. */
export function rotatedBox(type: SymbolType, rotation = 0): [number, number, number, number] {
  const [x, y, w, h] = SYMBOL_BOX[type];
  return rotation % 180 !== 0 ? [-(y + h), x, h, w] : [x, y, w, h];
}

/** Extent of a markup in drawing points, e.g. for clouding it. */
export function markupBounds(m: Markup) {
  if (isPolylineType(m.type)) return bounds(m.points);
  const [x, y, w, h] = rotatedBox(m.type as SymbolType, m.rotation);
  const p = m.points[0];
  return { minX: p.x + x, minY: p.y + y, maxX: p.x + x + w, maxY: p.y + y + h };
}

/** Corners of the revision cloud drawn around a markup that a client comment refers to. */
export function revisionCloudCorners(m: Markup, pad = 9) {
  const b = markupBounds(m);
  return [
    { x: b.minX - pad, y: b.minY - pad },
    { x: b.maxX + pad, y: b.minY - pad },
    { x: b.maxX + pad, y: b.maxY + pad },
    { x: b.minX - pad, y: b.maxY + pad },
  ];
}

export type LabelPlacement = { x: number; y: number; anchor: 'start' | 'middle' | 'end' };

/** Where the tag sits for each symbol, kept upright whatever the rotation. Instruments carry it in the bubble. */
export function labelPlacement(type: SymbolType, rotation = 0): LabelPlacement | null {
  const vertical = rotation % 180 !== 0;
  switch (type) {
    case 'blind':
      return vertical ? { x: 2, y: 14, anchor: 'start' } : { x: 8, y: -7, anchor: 'start' };
    case 'vent':
      return { x: 6, y: -12, anchor: 'start' };
    case 'drain':
      return { x: 7, y: 16, anchor: 'start' };
    case 'fill':
      return { x: -14, y: -21, anchor: 'middle' };
    case 'valve':
      return vertical ? { x: 10, y: -2, anchor: 'start' } : { x: 0, y: -10.5, anchor: 'middle' };
    case 'joint':
      return vertical ? { x: 10, y: -4, anchor: 'start' } : { x: 6, y: -7, anchor: 'start' };
    case 'gauge':
    case 'recorder':
      return null;
  }
}

/** Where the valve position (CLOSED, OPEN, LC, LO) sits under the tag. */
export function positionPlacement(rotation = 0): LabelPlacement {
  return rotation % 180 !== 0 ? { x: 10, y: 6.5, anchor: 'start' } : { x: 0, y: 16, anchor: 'middle' };
}

/** PI-101 gives ["PI", "101"] for the bubble. */
export function splitInstrumentTag(tag: string): [string, string] {
  const i = tag.indexOf('-');
  return i < 0 ? [tag, ''] : [tag.slice(0, i), tag.slice(i + 1)];
}

export const isClosed = (p?: ValvePosition) => p === 'closed' || p === 'locked closed';

export function positionAbbrev(p?: ValvePosition): string {
  return p === 'locked closed' ? 'LC' : p === 'locked open' ? 'LO' : p === 'open' ? 'OPEN' : 'CLOSED';
}

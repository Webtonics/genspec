/**
 * Draws the markup layer onto a PDF page on top of the embedded client drawing.
 * Shapes, sizes and label positions mirror the Markup studio overlay (shared
 * geometry in src/markup/symbols.ts), in engineering colours.
 */
import {
  type Color,
  LineJoinStyle,
  TextRenderingMode,
  popGraphicsState,
  pushGraphicsState,
  setLineJoin,
  setLineWidth,
  setStrokingColor,
  setTextRenderingMode,
} from 'pdf-lib';
import { cloudPath, polylinePath, pointAlong } from '@/markup/geometry';
import { type SymbolType, isPolylineType } from '@/markup/ops';
import {
  isClosed,
  labelPlacement,
  positionAbbrev,
  positionPlacement,
  revisionCloudCorners,
  splitInstrumentTag,
} from '@/markup/symbols';
import type { Markup, Point, ValvePosition } from '@/model/types';
import { COLORS, type Canvas } from './pdfKit';

type Ink = 'markup' | 'instrument' | 'white';
type Prim =
  | { k: 'line'; a: Point; b: Point; w: number; ink: Ink }
  | { k: 'circle'; c: Point; r: number; fill?: Ink; stroke?: Ink; w?: number }
  | { k: 'poly'; pts: Point[]; closed: boolean; fill?: Ink; stroke?: Ink; w?: number };

const INK: Record<Ink, Color> = { markup: COLORS.markup, instrument: COLORS.instrument, white: COLORS.white };
const P = (x: number, y: number): Point => ({ x, y });

/** The symbol as primitives around (0, 0), before rotation. Mirrors SymbolShape in MarkupGlyph.tsx. */
function shape(type: SymbolType, valve?: ValvePosition): Prim[] {
  switch (type) {
    case 'blind':
      return [
        { k: 'line', a: P(0, 0), b: P(0, -11), w: 1.6, ink: 'markup' },
        { k: 'circle', c: P(0, -11), r: 4.2, fill: 'white', stroke: 'markup', w: 1.6 },
        { k: 'circle', c: P(0, 0), r: 4.6, fill: 'markup' },
      ];
    case 'vent':
      return [
        { k: 'circle', c: P(0, 0), r: 2, fill: 'markup' },
        { k: 'line', a: P(0, 0), b: P(0, -15), w: 1.6, ink: 'markup' },
        { k: 'poly', pts: [P(-5, -9.5), P(0, -16), P(5, -9.5)], closed: false, stroke: 'markup', w: 1.6 },
      ];
    case 'drain':
      return [
        { k: 'circle', c: P(0, 0), r: 2, fill: 'markup' },
        { k: 'line', a: P(0, 0), b: P(0, 10), w: 1.6, ink: 'markup' },
        { k: 'poly', pts: [P(-6, 10), P(6, 10), P(0, 17.5)], closed: true, fill: 'white', stroke: 'markup', w: 1.5 },
      ];
    case 'fill':
      return [
        { k: 'circle', c: P(-14, -14), r: 3.6, fill: 'white', stroke: 'markup', w: 1.5 },
        { k: 'line', a: P(-11.4, -11.4), b: P(-4, -4), w: 1.6, ink: 'markup' },
        { k: 'poly', pts: [P(0, 0), P(-7, -2.6), P(-2.6, -7)], closed: true, fill: 'markup' },
      ];
    case 'gauge':
    case 'recorder':
      return [
        { k: 'line', a: P(0, 0), b: P(0, -9), w: 1.2, ink: 'instrument' },
        { k: 'circle', c: P(0, -18.5), r: 9.5, fill: 'white', stroke: 'instrument', w: 1.4 },
        ...(type === 'recorder' ? [{ k: 'line' as const, a: P(-5.5, -9.6), b: P(5.5, -9.6), w: 1.2, ink: 'instrument' as const }] : []),
      ];
    case 'valve': {
      const fill: Ink = isClosed(valve) ? 'markup' : 'white';
      return [
        { k: 'poly', pts: [P(-10, -6.5), P(-10, 6.5), P(0, 0)], closed: true, fill, stroke: 'markup', w: 1.5 },
        { k: 'poly', pts: [P(10, -6.5), P(10, 6.5), P(0, 0)], closed: true, fill, stroke: 'markup', w: 1.5 },
      ];
    }
    case 'joint':
      return [
        { k: 'line', a: P(-2.6, -8), b: P(-2.6, 8), w: 2.2, ink: 'markup' },
        { k: 'line', a: P(2.6, -8), b: P(2.6, 8), w: 2.2, ink: 'markup' },
      ];
  }
}

/**
 * Text with a white halo so it reads over the drawing's linework: one pass drawn
 * as a thick white outline (text render mode stroke), then the text on top.
 */
export function haloText(cv: Canvas, text: string, x: number, y: number, size: number, color: Color, anchor: 'start' | 'middle' | 'end' = 'start') {
  const align = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
  cv.page.pushOperators(
    pushGraphicsState(),
    setTextRenderingMode(TextRenderingMode.Outline),
    setLineWidth(size * 0.32),
    setLineJoin(LineJoinStyle.Round),
    setStrokingColor(COLORS.white),
  );
  cv.text(text, x, y, { size, font: 'bold', color: COLORS.white, align });
  cv.page.pushOperators(popGraphicsState());
  cv.text(text, x, y, { size, font: 'bold', color, align });
}

function drawPrims(cv: Canvas, prims: Prim[], at: Point, rotation: number) {
  const r = (rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const t = (p: Point): Point => ({ x: at.x + p.x * cos - p.y * sin, y: at.y + p.x * sin + p.y * cos });
  for (const pr of prims) {
    if (pr.k === 'line') {
      const a = t(pr.a);
      const b = t(pr.b);
      cv.line(a.x, a.y, b.x, b.y, { color: INK[pr.ink], width: pr.w });
    } else if (pr.k === 'circle') {
      const c = t(pr.c);
      cv.circle(c.x, c.y, pr.r, { fill: pr.fill && INK[pr.fill], stroke: pr.stroke && INK[pr.stroke], width: pr.w });
    } else {
      cv.path(polylinePath(pr.pts.map(t), pr.closed), 0, 0, {
        fill: pr.fill && INK[pr.fill],
        stroke: pr.stroke && INK[pr.stroke],
        width: pr.w,
      });
    }
  }
}

function drawSymbol(cv: Canvas, m: Markup, at: Point) {
  const type = m.type as SymbolType;
  const rotation = m.rotation ?? 0;
  drawPrims(cv, shape(type, m.valvePosition), at, rotation);

  if (type === 'gauge' || type === 'recorder') {
    const [letters, number] = splitInstrumentTag(m.tag);
    cv.text(letters, at.x, at.y + (number ? -19.8 : -16.2), { size: number ? 6.6 : 7, font: 'bold', color: COLORS.instrument, align: 'center' });
    if (number) cv.text(number, at.x, at.y - 12.6, { size: 5.6, font: 'bold', color: COLORS.instrument, align: 'center' });
  }
  const label = labelPlacement(type, rotation);
  if (label && m.tag) haloText(cv, m.tag, at.x + label.x, at.y + label.y, 7, COLORS.markup, label.anchor);
  if (type === 'valve') {
    const pos = positionPlacement(rotation);
    haloText(cv, positionAbbrev(m.valvePosition), at.x + pos.x, at.y + pos.y, 5.6, COLORS.markup, pos.anchor);
  }
}

function drawBoundary(cv: Canvas, m: Markup, origin: Point, sectionName?: string) {
  const closed = m.points.length >= 3;
  cv.path(cloudPath(m.points, closed), origin.x, origin.y, {
    stroke: COLORS.markup,
    width: 1.8,
    ...(closed ? { fill: COLORS.markup, opacity: 0.045 } : {}),
  });
  const top = m.points.reduce((best, p) => (p.y < best.y ? p : best), m.points[0]);
  haloText(cv, sectionName ? `${m.tag} · ${sectionName}` : m.tag, origin.x + top.x, origin.y + top.y - 9, 8, COLORS.markup);
}

function drawPurgeRoute(cv: Canvas, m: Markup, origin: Point) {
  const d = polylinePath(m.points);
  cv.path(d, origin.x, origin.y, { stroke: COLORS.highlight, width: 9, strokeOpacity: 0.45, round: true });
  cv.path(d, origin.x, origin.y, { stroke: COLORS.markup, width: 1.6, dash: [6, 4] });
  const end = pointAlong(m.points, 1);
  const a = end.angle;
  const tip = end.point;
  const back = { x: tip.x - Math.cos(a) * 9, y: tip.y - Math.sin(a) * 9 };
  const nx = -Math.sin(a) * 4.5;
  const ny = Math.cos(a) * 4.5;
  cv.path(polylinePath([tip, { x: back.x + nx, y: back.y + ny }, { x: back.x - nx, y: back.y - ny }], true), origin.x, origin.y, {
    fill: COLORS.markup,
  });
  const mid = pointAlong(m.points, 0.5).point;
  haloText(cv, m.tag, origin.x + mid.x, origin.y + mid.y - 9, 7.5, COLORS.markup, 'middle');
}

/**
 * Draw markups whose page coordinates (points from the drawing's top-left) are
 * placed at `origin` on the canvas. Lines go under symbols, as in the studio.
 */
export function drawMarkups(cv: Canvas, markups: Markup[], origin: Point, sectionNames: Map<string, string>) {
  const lines = markups.filter((m) => isPolylineType(m.type));
  const symbols = markups.filter((m) => !isPolylineType(m.type));
  for (const m of lines) {
    if (m.type === 'boundary') drawBoundary(cv, m, origin, m.sectionId ? sectionNames.get(m.sectionId) : undefined);
    else drawPurgeRoute(cv, m, origin);
  }
  for (const m of symbols) drawSymbol(cv, m, { x: origin.x + m.points[0].x, y: origin.y + m.points[0].y });
}

/** Revision delta: triangle with the revision letter, centred at (cx, cy). */
export function revisionTriangle(cv: Canvas, cx: number, cy: number, rev: string, size = 15) {
  const h = (size * Math.sqrt(3)) / 2;
  cv.path(
    polylinePath(
      [
        { x: cx, y: cy - (2 * h) / 3 },
        { x: cx + size / 2, y: cy + h / 3 },
        { x: cx - size / 2, y: cy + h / 3 },
      ],
      true,
    ),
    0,
    0,
    { fill: COLORS.white, stroke: COLORS.markup, width: 1.4 },
  );
  cv.text(rev, cx, cy + h / 3 - 2.6, { size: size * 0.5, font: 'bold', color: COLORS.markup, align: 'center' });
}

/** Revision cloud around a markup with the revision delta at its top right corner. */
export function cloudMarkup(cv: Canvas, m: Markup, origin: Point, rev: string) {
  const pts = revisionCloudCorners(m);
  cv.path(cloudPath(pts, true, 9), origin.x, origin.y, { stroke: COLORS.markup, width: 1.4 });
  revisionTriangle(cv, origin.x + pts[1].x + 4, origin.y + pts[1].y - 4, rev, 14);
}

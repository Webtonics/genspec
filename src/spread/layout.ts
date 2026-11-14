/**
 * Rule-based layout for spread diagrams.
 *
 * Equipment runs left to right in flow order along the main line. Each item gets
 * a grid column wide enough for its symbol, the instruments mounted above it and
 * its labels (measured with the Helvetica width table), plus a gap. Instruments
 * sit in slots above their own equipment, labels sit in their own column below,
 * so nothing can overlap. Every text, symbol and bubble records a box so tests
 * can prove that.
 */
import { BUBBLE_RADIUS } from '@/symbols/instrument';
import { textWidth, wrapText } from './textWidth';
import type { Attachment, NodeKind, SpreadNode, SpreadSpec } from './types';

type NodeSpec = {
  /** Pipe connection points, x relative to the node origin. */
  ports: [number, number];
  /** Symbol extent relative to the node origin: [minX, minY, maxX, maxY]. */
  box: [number, number, number, number];
};

export const NODE_SPECS: Record<NodeKind, NodeSpec> = {
  tank: { ports: [-32, 34], box: [-32, -92, 34, 8] },
  pump: { ports: [-22, 22], box: [-22, -22, 22, 29] },
  testPump: { ports: [-22, 22], box: [-22, -22, 22, 29] },
  compressor: { ports: [-24, 24], box: [-24, -24, 24, 29] },
  n2unit: { ports: [-48, 48], box: [-48, -32, 48, 32] },
  gate: { ports: [-12, 12], box: [-12, -8, 12, 8] },
  ball: { ports: [-12, 12], box: [-12, -8, 12, 8] },
  globe: { ports: [-12, 12], box: [-12, -8, 12, 8] },
  check: { ports: [-11, 10], box: [-11, -9, 10, 9] },
  flowmeter: { ports: [-16, 16], box: [-16, -11, 16, 11] },
  injection: { ports: [0, 0], box: [-13, -62, 13, 3] },
  launcher: { ports: [-48, 48], box: [-48, -21, 48, 21] },
  receiver: { ports: [-48, 48], box: [-48, -21, 48, 21] },
  section: { ports: [-140, 140], box: [-140, -44, 140, 44] },
  outlet: { ports: [0, 70], box: [0, -16, 70, 16] },
  ventStack: { ports: [0, 38], box: [0, -78, 38, 4] },
};

export const TEXT = { tag: 11.5, line: 10, step: 14 };
const MARGIN = 48;
const GAP = 30;
const BUBBLE_DY = -84;
const LEGEND_W = 420;
const TITLE_W = 440;
const TITLE_H = 180;
const ZONE_GAP = 24;
const MIN_NOTES_W = 320;

export type Box = { x0: number; y0: number; x1: number; y1: number; owner: string; what: string; inside?: boolean };

export type PlacedText = {
  x: number;
  y: number;
  text: string;
  size: number;
  bold?: boolean;
  anchor: 'start' | 'middle' | 'end';
  tone: 'text' | 'muted' | 'accent';
};

export type PlacedNode = { node: SpreadNode; x: number; y: number; lane: 'main' | 'lower'; center: number; colLeft: number; colRight: number };

export type PlacedAttachment = { attachment: Attachment; owner: string; x: number; lineY: number; tapY: number };

export type Arrow = { x: number; y: number; direction: 'right' | 'up' };

export type LegendKey = NodeKind | 'instrument' | 'relief' | 'vent' | 'flow';

export const LEGEND_LABELS: Record<LegendKey, string> = {
  tank: 'Tank',
  pump: 'Centrifugal pump',
  testPump: 'Positive displacement pump',
  compressor: 'Air compressor',
  n2unit: 'Nitrogen unit',
  gate: 'Gate valve',
  ball: 'Ball valve',
  globe: 'Globe valve',
  check: 'Check valve',
  flowmeter: 'Flow meter',
  injection: 'Chemical injection',
  launcher: 'Pig launcher',
  receiver: 'Pig receiver',
  section: 'Test section (cloud)',
  outlet: 'Off-page connection',
  ventStack: 'Vent stack',
  instrument: 'Instrument, field mounted',
  relief: 'Relief valve',
  vent: 'Vent',
  flow: 'Flow direction',
};

export type SpreadLayout = {
  width: number;
  height: number;
  mainY: number;
  lowerY?: number;
  nodes: PlacedNode[];
  attachments: PlacedAttachment[];
  pipes: { x: number; y: number }[][];
  junctions: { x: number; y: number }[];
  arrows: Arrow[];
  texts: PlacedText[];
  boxes: Box[];
  frame: { x: number; y: number; w: number; h: number };
  legend: { x: number; y: number; w: number; h: number; entries: { key: LegendKey; label: string; x: number; y: number }[] };
  notes: { x: number; y: number; w: number; h: number; lines: { text: string; x: number; y: number }[] };
  titleBlock: { x: number; y: number; w: number; h: number };
};

function slotWidth(a: Attachment): number {
  switch (a.kind) {
    case 'instrument':
      return 2 * BUBBLE_RADIUS + 10;
    case 'vent':
      return Math.max(34, textWidth(a.tag, 10, true) + 10);
    case 'relief':
      return Math.max(58, textWidth(a.tag, 10.5, true) + 12, textWidth(a.note, 9.5) + 12);
  }
}

const lineSize = (i: number) => (i === 0 ? TEXT.tag : TEXT.line);

/** Horizontal extent of a mounted relief valve or vent around its slot centre, and where it taps the line. */
const FOOTPRINT: Record<'relief' | 'vent', { left: number; right: number; tap: number }> = {
  relief: { left: -13, right: 18, tap: -6 },
  vent: { left: -7, right: 7, tap: 0 },
};

type Slot = { a: Attachment; dx: number; width: number; onSymbol: boolean };

/**
 * Slot positions above a node, as offsets from the column centre (the symbol is
 * centred in its column). Slots sit side by side. A relief valve or vent that
 * taps the pipe but would straddle the equipment edge is moved clear of it;
 * one whose tapping lands on the equipment is mounted on top of it.
 */
function slotPlan(node: SpreadNode): Slot[] {
  const above = node.above ?? [];
  const [bx0, , bx1] = NODE_SPECS[node.kind].box;
  const half = (bx1 - bx0) / 2;
  const widths = above.map(slotWidth);
  let left = -widths.reduce((s, w) => s + w, 0) / 2;
  return above.map((a, i) => {
    const width = widths[i];
    let dx = left + width / 2;
    if (a.kind === 'instrument') {
      left += width;
      return { a, dx, width, onSymbol: dx >= -half && dx <= half };
    }
    const fp = FOOTPRINT[a.kind];
    const onSymbol = dx + fp.tap >= -half && dx + fp.tap <= half;
    if (!onSymbol && dx + fp.left < half && dx + fp.right > -half) {
      dx = dx >= 0 ? half - fp.left + 3 : -half - fp.right - 3;
    }
    left = Math.max(left + width, dx + width / 2);
    return { a, dx, width, onSymbol };
  });
}

export function columnWidth(node: SpreadNode): number {
  const [x0, , x1] = NODE_SPECS[node.kind].box;
  const labels = Math.max(0, ...node.lines.map((l, i) => textWidth(l, lineSize(i), i === 0)));
  const slots = slotPlan(node).reduce((m, s) => Math.max(m, Math.abs(s.dx - s.width / 2), Math.abs(s.dx + s.width / 2)), 0) * 2;
  return Math.ceil(Math.max(x1 - x0, labels, slots) + GAP);
}

function textBox(t: PlacedText, owner: string, inside?: boolean): Box {
  const w = textWidth(t.text, t.size, t.bold);
  const x0 = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x;
  return { x0, y0: t.y - t.size * 0.78, x1: x0 + w, y1: t.y + t.size * 0.22, owner, what: `text:${t.text}`, inside };
}

type LaneResult = { placed: PlacedNode[]; bottom: number };

export function layoutSpread(spec: SpreadSpec): SpreadLayout {
  const texts: PlacedText[] = [];
  const boxes: Box[] = [];
  const attachments: PlacedAttachment[] = [];
  const pipes: { x: number; y: number }[][] = [];
  const arrows: Arrow[] = [];
  const junctions: { x: number; y: number }[] = [];

  const addText = (t: PlacedText, owner: string, inside?: boolean) => {
    texts.push(t);
    boxes.push(textBox(t, owner, inside));
  };

  const placeLane = (nodes: SpreadNode[], laneY: number, startX: number, lane: 'main' | 'lower'): LaneResult => {
    let cursor = startX;
    let bottom = laneY;
    const placed = nodes.map((node) => {
      const spec = NODE_SPECS[node.kind];
      const [bx0, by0, bx1, by1] = spec.box;
      const width = columnWidth(node);
      const center = cursor + width / 2;
      const x = center - (bx0 + bx1) / 2;
      boxes.push({ x0: x + bx0, y0: laneY + by0, x1: x + bx1, y1: laneY + by1, owner: node.id, what: 'symbol' });

      // Labels under the symbol, centred in the column.
      let y = laneY + by1 + 18;
      node.lines.forEach((line, i) => {
        if (line) {
          addText({ x: center, y, text: line, size: lineSize(i), bold: i === 0, anchor: 'middle', tone: i === 0 ? 'text' : 'muted' }, node.id);
        }
        bottom = Math.max(bottom, y + 4);
        y += TEXT.step;
      });

      // Test section titles inside the cloud.
      if (node.kind === 'section' && node.inside) {
        if (node.inside[0]) addText({ x, y: laneY - 18, text: node.inside[0], size: 12, bold: true, anchor: 'middle', tone: 'accent' }, node.id, true);
        if (node.inside[1]) addText({ x, y: laneY + 29, text: node.inside[1], size: 9.5, bold: true, anchor: 'middle', tone: 'accent' }, node.id, true);
      }

      // Instruments, relief valves and vents in slots above, centred on the column.
      for (const { a, dx, onSymbol } of slotPlan(node)) {
        const cx = center + dx;
        const tapY = onSymbol ? laneY + by0 : laneY;
        attachments.push({ attachment: a, owner: node.id, x: cx, lineY: laneY, tapY });
        if (a.kind === 'instrument') {
          const cy = laneY + BUBBLE_DY;
          boxes.push({ x0: cx - BUBBLE_RADIUS, y0: cy - BUBBLE_RADIUS, x1: cx + BUBBLE_RADIUS, y1: cy + BUBBLE_RADIUS, owner: node.id, what: `bubble:${a.letters}-${a.number}` });
        } else if (a.kind === 'relief') {
          boxes.push({ x0: cx - 13, y0: tapY - 48, x1: cx + 18, y1: tapY - 1, owner: node.id, what: `relief:${a.tag}` });
          addText({ x: cx, y: tapY - 66, text: a.tag, size: 10.5, bold: true, anchor: 'middle', tone: 'text' }, node.id);
          addText({ x: cx, y: tapY - 53, text: a.note, size: 9.5, anchor: 'middle', tone: 'muted' }, node.id);
        } else {
          boxes.push({ x0: cx - 7, y0: tapY - 25, x1: cx + 7, y1: tapY - 1, owner: node.id, what: `vent:${a.tag}` });
          addText({ x: cx, y: tapY - 32, text: a.tag, size: 10, bold: true, anchor: 'middle', tone: 'text' }, node.id);
        }
      }

      const placedNode: PlacedNode = { node, x, y: laneY, lane, center, colLeft: cursor, colRight: cursor + width };
      cursor += width;
      return placedNode;
    });
    return { placed, bottom };
  };

  /** Connect consecutive nodes and put a flow arrow where it will not sit on an instrument tapping. */
  const connect = (placed: PlacedNode[], laneY: number, avoid: number[]) => {
    for (let i = 0; i < placed.length - 1; i++) {
      const a = placed[i];
      const b = placed[i + 1];
      const x1 = a.x + NODE_SPECS[a.node.kind].ports[1];
      const x2 = b.x + NODE_SPECS[b.node.kind].ports[0];
      if (x2 <= x1) continue;
      pipes.push([
        { x: x1, y: laneY },
        { x: x2, y: laneY },
      ]);
      if (x2 - x1 < 34) continue;
      const ax = [0.5, 0.32, 0.68].map((t) => x1 + (x2 - x1) * t).find((cand) => avoid.every((t) => Math.abs(t - cand) > 13));
      if (ax !== undefined) arrows.push({ x: ax, y: laneY, direction: 'right' });
    }
  };

  // Main line.
  const mainY = 200;
  const main = placeLane(spec.main, mainY, MARGIN + 6, 'main');
  let contentBottom = main.bottom;
  let lowerY: number | undefined;
  let lower: LaneResult | undefined;
  const connectNode = spec.lower ? main.placed.find((p) => p.node.id === spec.lower?.connectTo) : undefined;
  const connectX = connectNode?.colLeft;

  // Second line teeing into the main line at a column boundary, so it never crosses a label.
  if (spec.lower && connectX !== undefined) {
    lowerY = main.bottom + 40 + 100;
    const laneWidth = spec.lower.nodes.reduce((s, n) => s + columnWidth(n), 0);
    lower = placeLane(spec.lower.nodes, lowerY, Math.max(MARGIN + 6, connectX - 26 - laneWidth), 'lower');
    const last = lower.placed[lower.placed.length - 1];
    const lastPort = last.x + NODE_SPECS[last.node.kind].ports[1];
    pipes.push([
      { x: lastPort, y: lowerY },
      { x: connectX, y: lowerY },
      { x: connectX, y: mainY },
    ]);
    junctions.push({ x: connectX, y: mainY });
    arrows.push({ x: connectX, y: (mainY + lowerY) / 2 + 20, direction: 'up' });
    contentBottom = lower.bottom;
  }

  const taps = (lane: 'main' | 'lower') =>
    attachments.filter((a) => (lane === 'main' ? a.lineY === mainY : a.lineY === lowerY)).map((a) => a.x);
  connect(main.placed, mainY, [...taps('main'), ...(connectX !== undefined ? [connectX] : [])]);
  if (lower && lowerY !== undefined) connect(lower.placed, lowerY, taps('lower'));

  // Title.
  addText({ x: MARGIN, y: 54, text: spec.title.toUpperCase(), size: 19, bold: true, anchor: 'start', tone: 'text' }, 'title');
  addText({ x: MARGIN, y: 76, text: spec.subtitle, size: 11.5, anchor: 'start', tone: 'muted' }, 'title');

  // Bottom zone: legend, notes, title block.
  const contentRight = Math.max(...main.placed.map((p) => p.colRight));
  const width = Math.ceil(Math.max(contentRight + MARGIN, 2 * MARGIN + LEGEND_W + ZONE_GAP + MIN_NOTES_W + ZONE_GAP + TITLE_W));
  const zoneY = contentBottom + 44;

  const legendKeys: LegendKey[] = [];
  const addKey = (k: LegendKey) => !legendKeys.includes(k) && legendKeys.push(k);
  for (const n of [...spec.main, ...(spec.lower?.nodes ?? [])]) {
    addKey(n.kind);
    for (const a of n.above ?? []) addKey(a.kind);
  }
  addKey('flow');
  const rows = Math.ceil(legendKeys.length / 2);
  const legend = {
    x: MARGIN,
    y: zoneY,
    w: LEGEND_W,
    h: 40 + rows * 26 + 4,
    entries: legendKeys.map((key, k) => ({
      key,
      label: LEGEND_LABELS[key],
      x: MARGIN + 14 + Math.floor(k / rows) * (LEGEND_W / 2),
      y: zoneY + 44 + (k % rows) * 26,
    })),
  };

  const titleX = width - MARGIN - TITLE_W;
  const notesX = MARGIN + LEGEND_W + ZONE_GAP;
  const notesW = titleX - ZONE_GAP - notesX;
  const noteLines: { text: string; x: number; y: number }[] = [];
  let ny = zoneY + 44;
  spec.notes.forEach((note, i) => {
    noteLines.push({ text: `${i + 1}.`, x: notesX + 14, y: ny });
    for (const line of wrapText(note, notesW - 50, 10.5)) {
      noteLines.push({ text: line, x: notesX + 34, y: ny });
      ny += 15;
    }
    ny += 3;
  });
  const notes = { x: notesX, y: zoneY, w: notesW, h: Math.max(ny - zoneY + 6, 60), lines: noteLines };
  const titleBlock = { x: titleX, y: zoneY, w: TITLE_W, h: TITLE_H };

  const zoneH = Math.max(legend.h, notes.h, titleBlock.h);
  for (const [owner, z] of [
    ['legend', legend],
    ['notes', notes],
    ['titleBlock', { ...titleBlock, h: zoneH }],
  ] as const) {
    boxes.push({ x0: z.x, y0: z.y, x1: z.x + z.w, y1: z.y + (owner === 'titleBlock' ? zoneH : z.h), owner, what: 'zone' });
  }

  const height = Math.ceil(zoneY + zoneH + 34);

  return {
    width,
    height,
    mainY,
    lowerY,
    nodes: [...main.placed, ...(lower?.placed ?? [])],
    attachments,
    pipes,
    junctions,
    arrows,
    texts,
    boxes,
    frame: { x: 14, y: 14, w: width - 28, h: height - 28 },
    legend,
    notes,
    titleBlock,
  };
}

/** Pairs of boxes that overlap. Text inside the test section cloud is allowed on its own cloud. */
export function findOverlaps(layout: SpreadLayout): [Box, Box][] {
  const out: [Box, Box][] = [];
  const b = layout.boxes;
  for (let i = 0; i < b.length; i++) {
    for (let j = i + 1; j < b.length; j++) {
      const p = b[i];
      const q = b[j];
      if (p.owner === q.owner && (p.inside || q.inside)) continue;
      const overlap = p.x0 < q.x1 - 0.5 && q.x0 < p.x1 - 0.5 && p.y0 < q.y1 - 0.5 && q.y0 < p.y1 - 0.5;
      if (overlap) out.push([p, q]);
    }
  }
  return out;
}

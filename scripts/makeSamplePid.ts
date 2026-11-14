/**
 * Generates the sample client P&ID the demo is marked up on:
 *
 *   public/samples/sample-pid.pdf       the drawing, served to the browser
 *   src/model/samplePid.generated.ts    a base64 copy seeded into the demo job
 *
 * Fictional client "Delta Export Co.": A3 landscape, pig launcher L-101, 12 inch
 * export line 12"-EXP-001 with MV-101, MV-102 and KV-101, receiver R-101.
 *
 * Geometry is authored in PDF points from the top-left corner of the page with y
 * pointing down, the same convention GenSpec uses for markups, so positions read
 * here match what the Markup studio stores.
 *
 * Output is byte-for-byte deterministic (fixed metadata dates).
 * Run with: npm run sample:pid
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Color,
  LineCapStyle,
  type PDFFont,
  type PDFPage,
  type PDFPageDrawSVGOptions,
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PDF_OUT = resolve(ROOT, 'public/samples/sample-pid.pdf');
const TS_OUT = resolve(ROOT, 'src/model/samplePid.generated.ts');
/** File name the demo job shows, as a client would send it. */
const CLIENT_FILE_NAME = 'DEC-EXP-PID-2001_Rev0.pdf';
const ISSUE_DATE = new Date('2025-08-20T09:00:00Z');

// ---------------------------------------------------------------------------
// Sheet geometry (pt)

const MM = 72 / 25.4;
const W = 420 * MM; // A3 landscape
const H = 297 * MM;

/** Drawing frame: 20 mm filing margin on the left, 10 mm elsewhere. */
const FRAME = { left: 20 * MM, top: 10 * MM, right: W - 10 * MM, bottom: H - 10 * MM };
/** Zone reference band between frame and drawing area. */
const BAND = 12;
const AREA = { left: FRAME.left + BAND, top: FRAME.top + BAND, right: FRAME.right - BAND, bottom: FRAME.bottom - BAND };

/** Title block (180 mm wide, bottom right) and revision block above it. */
const TB = { left: AREA.right - 180 * MM, right: AREA.right, top: AREA.bottom - 170, bottom: AREA.bottom };
const REV = { left: TB.left, right: TB.right, top: TB.top - 76, bottom: TB.top };
/** Everything above this line is the process diagram. */
const DIAGRAM_BOTTOM = REV.top;

/** Process centrelines. */
const M = 360; // mainline
const HDR = 200; // inlet header from the export pumps
const OUT = 470; // receiver outlet header to storage
const L101 = { x1: 150, x2: 350, top: M - 22, bottom: M + 22 };
const R101 = { x1: 960, x2: 1125, top: M - 22, bottom: M + 22 };

const LW = {
  frame: 1.4,
  process: 1.4,
  secondary: 1.1,
  small: 0.8,
  equipment: 1.1,
  instrument: 0.6,
  thin: 0.5,
  grid: 0.7,
};

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

// ---------------------------------------------------------------------------
// Drawing helpers in top-left coordinates

type FontKey = 'regular' | 'bold' | 'oblique';
type Paint = { stroke?: Color; fill?: Color; width?: number; dash?: number[] };
type Pt = [number, number];
type Align = 'left' | 'center' | 'right';

class Sheet {
  private readonly page: PDFPage;
  private readonly fonts: Record<FontKey, PDFFont>;

  constructor(page: PDFPage, fonts: Record<FontKey, PDFFont>) {
    this.page = page;
    this.fonts = fonts;
  }

  /** SVG path in top-left coordinates. pdf-lib flips y about the origin we pass. */
  path(d: string, p: Paint) {
    const opts: PDFPageDrawSVGOptions = { x: 0, y: H, borderLineCap: LineCapStyle.Butt };
    if (p.fill) opts.color = p.fill;
    if (p.stroke) {
      opts.borderColor = p.stroke;
      opts.borderWidth = p.width ?? 1;
    }
    if (p.dash) opts.borderDashArray = p.dash;
    this.page.drawSvgPath(d, opts);
  }

  polyline(points: Pt[], width: number, dash?: number[]) {
    this.path(`M ${points.map((p) => p.join(' ')).join(' L ')}`, { stroke: BLACK, width, dash });
  }

  polygon(points: Pt[], p: Paint) {
    this.path(`M ${points.map((pt) => pt.join(' ')).join(' L ')} Z`, p);
  }

  line(x1: number, y1: number, x2: number, y2: number, width: number, dash?: number[]) {
    this.polyline(
      [
        [x1, y1],
        [x2, y2],
      ],
      width,
      dash,
    );
  }

  rect(x: number, y: number, w: number, h: number, p: Paint) {
    this.polygon(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      p,
    );
  }

  circle(cx: number, cy: number, r: number, p: Paint) {
    this.page.drawCircle({
      x: cx,
      y: H - cy,
      size: r,
      ...(p.fill ? { color: p.fill } : {}),
      ...(p.stroke ? { borderColor: p.stroke, borderWidth: p.width ?? 1 } : {}),
    });
  }

  textWidth(str: string, size: number, font: FontKey = 'regular') {
    return this.fonts[font].widthOfTextAtSize(str, size);
  }

  /** Text with its baseline at y. */
  text(str: string, x: number, y: number, o: { size?: number; font?: FontKey; align?: Align } = {}) {
    const size = o.size ?? 6;
    const font = o.font ?? 'regular';
    const w = this.textWidth(str, size, font);
    const dx = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0;
    this.page.drawText(str, { x: x + dx, y: H - y, size, font: this.fonts[font], color: BLACK });
  }

  /** Word-wrap text to a width. Returns the lines. A value never wraps away from its unit. */
  wrap(str: string, maxWidth: number, size: number, font: FontKey = 'regular'): string[] {
    const lines: string[] = [];
    let current = '';
    const glued = str.replace(/(\d) (mm|m|km|barg)\b/g, '$1 $2');
    for (const word of glued.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && this.textWidth(candidate, size, font) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
}

// ---------------------------------------------------------------------------
// P&ID symbols

type Orient = 'h' | 'v';

/** Gate or ball valve. Closed valves are drawn solid, per P&ID convention. */
function valve(
  s: Sheet,
  cx: number,
  cy: number,
  o: Orient,
  opts: { ball?: boolean; closed?: boolean; flanged?: boolean; actuator?: boolean; small?: boolean } = {},
) {
  const L = opts.small ? 8 : 11; // half length along the pipe
  const T = opts.small ? 4.5 : 6.5; // half width across the pipe
  const body: Paint = { stroke: BLACK, fill: opts.closed ? BLACK : WHITE, width: 0.9 };

  if (opts.actuator) {
    // Motor operator, stem perpendicular to the pipe.
    if (o === 'v') {
      s.line(cx - 13, cy, cx, cy, 0.8);
      s.rect(cx - 24, cy - 5.5, 11, 11, { stroke: BLACK, fill: WHITE, width: 0.8 });
      s.text('M', cx - 18.5, cy + 2.4, { size: 6.5, font: 'bold', align: 'center' });
    } else {
      s.line(cx, cy - 13, cx, cy, 0.8);
      s.rect(cx - 5.5, cy - 24, 11, 11, { stroke: BLACK, fill: WHITE, width: 0.8 });
      s.text('M', cx, cy - 16, { size: 6.5, font: 'bold', align: 'center' });
    }
  }

  if (o === 'h') {
    s.polygon([[cx - L, cy - T], [cx - L, cy + T], [cx, cy]], body);
    s.polygon([[cx + L, cy - T], [cx + L, cy + T], [cx, cy]], body);
  } else {
    s.polygon([[cx - T, cy - L], [cx + T, cy - L], [cx, cy]], body);
    s.polygon([[cx - T, cy + L], [cx + T, cy + L], [cx, cy]], body);
  }

  if (opts.ball) {
    s.circle(cx, cy, 3.3, { stroke: BLACK, fill: opts.closed ? WHITE : BLACK, width: 0.8 });
  }

  if (opts.flanged) {
    const f = L + 3;
    const k = T + 2;
    if (o === 'h') {
      s.line(cx - f, cy - k, cx - f, cy + k, 1.4);
      s.line(cx + f, cy - k, cx + f, cy + k, 1.4);
    } else {
      s.line(cx - k, cy - f, cx + k, cy - f, 1.4);
      s.line(cx - k, cy + f, cx + k, cy + f, 1.4);
    }
  }
}

/** Blind flange closing the end of a small bore line. */
function blindEnd(s: Sheet, x: number, y: number) {
  s.line(x - 5.5, y, x + 5.5, y, 2.2);
}

/** 2 inch vent up from a nozzle: valve and blind flange. */
function vent(s: Sheet, x: number, yNozzle: number) {
  const end = yNozzle - 38;
  s.line(x, yNozzle, x, end, LW.small);
  valve(s, x, yNozzle - 19, 'v', { small: true, closed: true });
  blindEnd(s, x, end);
  s.text('2" VENT', x, end - 5, { size: 5, align: 'center' });
}

/** 2 inch drain down from a nozzle to closed drain: valve and blind flange. */
function drain(s: Sheet, x: number, yNozzle: number) {
  const end = yNozzle + 40;
  s.line(x, yNozzle, x, end, LW.small);
  valve(s, x, yNozzle + 20, 'v', { small: true, closed: true });
  blindEnd(s, x, end);
  s.text('2" CD', x, end + 9, { size: 5, align: 'center' });
}

/** ISA-5.1 instrument bubble. dcs draws the shared display (circle in square, line = control room). */
function bubble(s: Sheet, cx: number, cy: number, letters: string, num: string, opts: { dcs?: boolean } = {}) {
  const r = 10.5;
  if (opts.dcs) s.rect(cx - r, cy - r, 2 * r, 2 * r, { stroke: BLACK, fill: WHITE, width: 0.8 });
  s.circle(cx, cy, r, { stroke: BLACK, fill: WHITE, width: 0.8 });
  if (opts.dcs) s.line(cx - r, cy, cx + r, cy, 0.6);
  s.text(letters, cx, cy - (opts.dcs ? 2.2 : 0.8), { size: 6, font: 'bold', align: 'center' });
  s.text(num, cx, cy + 7.2, { size: 5.5, align: 'center' });
}

/** Instrument on a line: process connection then bubble. */
function instrument(s: Sheet, x: number, yLine: number, yBubble: number, letters: string, num: string) {
  const edge = yBubble > yLine ? yBubble - 10.5 : yBubble + 10.5;
  s.line(x, yLine, x, edge, LW.instrument);
  bubble(s, x, yBubble, letters, num);
}

/** Angle pattern pressure safety valve on a vessel nozzle, discharging right. */
function psv(s: Sheet, x: number, yNozzle: number, tag: string) {
  const c = yNozzle - 24;
  s.line(x, yNozzle, x, c + 10, LW.small);
  s.polyline([[x, c], [x - 3, c - 3], [x + 3, c - 6], [x - 3, c - 9], [x + 3, c - 12], [x, c - 14]], 0.7);
  s.polygon([[x - 5, c + 10], [x + 5, c + 10], [x, c]], { stroke: BLACK, fill: WHITE, width: 0.9 });
  s.polygon([[x + 10, c - 5], [x + 10, c + 5], [x, c]], { stroke: BLACK, fill: WHITE, width: 0.9 });
  s.line(x + 10, c, x + 30, c, LW.small);
  s.text('TO FLARE', x + 32, c + 2, { size: 5 });
  s.text(tag, x - 7, c - 2, { size: 6, font: 'bold', align: 'right' });
  s.text('SET 99 barg', x - 7, c + 6, { size: 5, align: 'right' });
}

/** Solid flow arrow on a line. */
function arrow(s: Sheet, x: number, y: number, dir: 'r' | 'd') {
  const a = 4;
  const b = 3.2;
  const pts: Pt[] =
    dir === 'r'
      ? [[x - a, y - b], [x + a, y], [x - a, y + b]]
      : [[x - b, y - a], [x, y + a], [x + b, y - a]];
  s.polygon(pts, { fill: BLACK });
}

/** Off-page connector (pentagon pointing in the flow direction). */
function offPage(s: Sheet, x1: number, x2: number, cy: number, title: string, ref: string) {
  s.polygon([[x1, cy - 13], [x2 - 10, cy - 13], [x2, cy], [x2 - 10, cy + 13], [x1, cy + 13]], {
    stroke: BLACK,
    fill: WHITE,
    width: 0.9,
  });
  const mid = (x1 + x2 - 10) / 2;
  s.text(title, mid, cy - 1.5, { size: 5.5, font: 'bold', align: 'center' });
  s.text(ref, mid, cy + 7, { size: 5, align: 'center' });
}

/** Horizontal pig launcher or receiver barrel with reducer and quick opening closure. */
function barrel(s: Sheet, b: typeof L101, tag: string, closureSide: 'left' | 'right') {
  const neck = 7;
  if (closureSide === 'left') {
    s.polygon([[b.x2, b.top], [b.x2 + 25, M - neck], [b.x2 + 25, M + neck], [b.x2, b.bottom]], {
      stroke: BLACK,
      fill: WHITE,
      width: LW.equipment,
    });
  } else {
    s.polygon([[b.x1 - 25, M - neck], [b.x1, b.top], [b.x1, b.bottom], [b.x1 - 25, M + neck]], {
      stroke: BLACK,
      fill: WHITE,
      width: LW.equipment,
    });
  }
  s.rect(b.x1, b.top, b.x2 - b.x1, b.bottom - b.top, { stroke: BLACK, fill: WHITE, width: LW.equipment });
  const doorX = closureSide === 'left' ? b.x1 - 3.5 : b.x2 + 3.5;
  s.line(doorX, b.top - 4, doorX, b.bottom + 4, 2.6);
  s.text('QOC', doorX, b.bottom + 14, { size: 5, align: 'center' });
  s.text(tag, (b.x1 + b.x2) / 2, M + 2.5, { size: 7.5, font: 'bold', align: 'center' });
}

function insulatingJoint(s: Sheet, x: number, tag: string) {
  s.rect(x - 2.5, M - 2, 5, 4, { fill: WHITE });
  s.line(x - 2.5, M - 8, x - 2.5, M + 8, 1.4);
  s.line(x + 2.5, M - 8, x + 2.5, M + 8, 1.4);
  s.text(tag, x, M + 18, { size: 5.5, align: 'center' });
}

function codeBreak(s: Sheet, x: number, left: string, right: string) {
  s.line(x, M - 55, x, M + 55, 0.7, [4, 2.5]);
  s.text('CODE BREAK', x, M - 60, { size: 5, font: 'bold', align: 'center' });
  s.text(left, x - 3, M - 48, { size: 5, align: 'right' });
  s.text(right, x + 3, M - 48, { size: 5 });
}

function kilometrePoint(s: Sheet, x: number, label: string) {
  s.line(x, M - 4, x, M + 4, 0.8);
  s.text(label, x, M + 18, { size: 5.5, align: 'center' });
}

/** Long-distance break: the line stops and resumes with slash marks. */
function pipeBreak(s: Sheet, x: number) {
  s.line(x - 4, M + 8, x + 4, M - 8, 1);
}

function lineLabel(s: Sheet, text: string, x: number, y: number, align: Align = 'center') {
  s.text(text, x, y, { size: 6, align });
}

function valveTag(s: Sheet, tag: string, x: number, y: number, align: Align = 'center', nc = false) {
  s.text(tag, x, y, { size: 6, font: 'bold', align });
  if (nc) s.text('NC', x, y + 8, { size: 5, align });
}

/** Equipment callout: underlined tag and description lines. */
function callout(s: Sheet, cx: number, top: number, tag: string, lines: string[]) {
  s.text(tag, cx, top, { size: 8, font: 'bold', align: 'center' });
  const w = s.textWidth(tag, 8, 'bold');
  s.line(cx - w / 2, top + 2, cx + w / 2, top + 2, 0.7);
  lines.forEach((line, i) => s.text(line, cx, top + 12 + i * 8.5, { size: 6, align: 'center' }));
}

// ---------------------------------------------------------------------------
// Drawing content

function drawFrame(s: Sheet) {
  s.rect(FRAME.left, FRAME.top, FRAME.right - FRAME.left, FRAME.bottom - FRAME.top, {
    stroke: BLACK,
    width: LW.frame,
  });
  s.rect(AREA.left, AREA.top, AREA.right - AREA.left, AREA.bottom - AREA.top, { stroke: BLACK, width: LW.thin });

  // Zone references: columns 1 to 8 left to right, rows A to F top to bottom.
  const cols = 8;
  const rows = 6;
  const colW = (AREA.right - AREA.left) / cols;
  const rowH = (AREA.bottom - AREA.top) / rows;
  for (let i = 0; i < cols; i++) {
    const x = AREA.left + i * colW;
    if (i > 0) {
      s.line(x, FRAME.top, x, AREA.top, LW.thin);
      s.line(x, AREA.bottom, x, FRAME.bottom, LW.thin);
    }
    s.text(String(i + 1), x + colW / 2, FRAME.top + 8.6, { size: 7, align: 'center' });
    s.text(String(i + 1), x + colW / 2, AREA.bottom + 8.6, { size: 7, align: 'center' });
  }
  for (let j = 0; j < rows; j++) {
    const y = AREA.top + j * rowH;
    if (j > 0) {
      s.line(FRAME.left, y, AREA.left, y, LW.thin);
      s.line(AREA.right, y, FRAME.right, y, LW.thin);
    }
    const letter = String.fromCharCode(65 + j);
    s.text(letter, FRAME.left + BAND / 2, y + rowH / 2 + 2.5, { size: 7, align: 'center' });
    s.text(letter, AREA.right + BAND / 2, y + rowH / 2 + 2.5, { size: 7, align: 'center' });
  }

  // Divider between the diagram and the notes and title block strip.
  s.line(AREA.left, DIAGRAM_BOTTOM, AREA.right, DIAGRAM_BOTTOM, LW.grid);
}

function drawProcess(s: Sheet) {
  // Lines first, so symbols drawn afterwards sit on top of them.
  s.polyline([[170, HDR], [490, HDR], [490, M]], LW.process); // 12"-EXP-010 inlet header and launcher bypass
  s.line(200, HDR, 200, L101.top, LW.secondary); // 6" kicker
  s.line(L101.x2 + 25, M, 695, M, LW.process); // launcher outlet and pipeline
  s.line(715, M, R101.x1 - 25, M, LW.process); // pipeline and receiver inlet
  s.polyline([[875, M], [875, OUT], [1060, OUT]], LW.process); // receiver bypass and outlet header
  s.line(985, R101.bottom, 985, OUT, LW.secondary); // receiver barrel outlet

  // Equipment
  barrel(s, L101, 'L-101', 'left');
  barrel(s, R101, 'R-101', 'right');
  callout(s, 250, 66, 'L-101', ['PIG LAUNCHER', '16" x 12", 6.0 m BARREL', 'DESIGN 99 barg @ 65 °C']);
  callout(s, 705, 66, '12"-EXP-001', [
    'EXPORT PIPELINE, 12.0 km',
    'API 5L X52, WT 9.53 mm',
    'DESIGN 99 barg, ASME B31.4',
  ]);
  callout(s, 1043, 66, 'R-101', ['PIG RECEIVER', '16" x 12", 7.5 m BARREL', 'DESIGN 99 barg @ 65 °C']);

  // Off-page connectors
  offPage(s, 80, 170, HDR, 'FROM P-101A/B', 'DEC-PID-1001');
  offPage(s, 1060, 1140, OUT, 'TO T-301A/B', 'DEC-PID-3001');

  // Launcher station
  valve(s, 410, HDR, 'h', { ball: true, flanged: true });
  valveTag(s, 'MV-103', 410, HDR - 12);
  valve(s, 200, 268, 'v', { ball: true, closed: true, actuator: true });
  valveTag(s, 'KV-101', 211, 266, 'left', true);
  valve(s, 410, M, 'h', { ball: true, closed: true, flanged: true });
  valveTag(s, 'MV-101', 410, M - 12);
  s.text('NC', 410, M + 17, { size: 5, align: 'center' });

  psv(s, 260, L101.top, 'PSV-101');
  vent(s, 330, L101.top);
  drain(s, 180, L101.bottom);
  drain(s, 330, L101.bottom);
  instrument(s, 250, L101.bottom, 420, 'PI', '101');
  instrument(s, 450, M, 315, 'XI', '101');
  s.text('PIG SIG.', 462, 312, { size: 5 });

  instrument(s, 520, M, 315, 'PT', '102');
  s.line(520, 304.5, 520, 272.5, LW.instrument, [3, 2]); // electrical signal to DCS
  bubble(s, 520, 262, 'PI', '102', { dcs: true });
  instrument(s, 545, M, 405, 'TT', '101');

  insulatingJoint(s, 570, 'IJ-101');
  codeBreak(s, 595, 'B31.3', 'B31.4');
  kilometrePoint(s, 612, 'KP 0+000');

  // Pipeline
  lineLabel(s, '12"-EXP-001', 650, M - 5);
  arrow(s, 675, M, 'r');
  pipeBreak(s, 695);
  pipeBreak(s, 715);
  s.text('APPROX. 12.0 km', 705, M + 22, { size: 5.5, font: 'bold', align: 'center' });
  s.text('BURIED PIPELINE', 705, M + 30, { size: 5.5, align: 'center' });
  s.text('(SEE NOTE 4)', 705, M + 38, { size: 5.5, align: 'center' });
  arrow(s, 742, M, 'r');
  lineLabel(s, '12"-EXP-001', 760, M - 5);
  kilometrePoint(s, 780, 'KP 12+000');

  // Receiver station
  codeBreak(s, 810, 'B31.4', 'B31.3');
  insulatingJoint(s, 830, 'IJ-201');
  instrument(s, 852, M, 315, 'XI', '201');
  s.text('PIG SIG.', 864, 312, { size: 5 });
  valve(s, 875, 420, 'v', { ball: true, flanged: true });
  valveTag(s, 'MV-104', 887, 422, 'left');
  arrow(s, 875, 448, 'd');
  valve(s, 910, M, 'h', { ball: true, closed: true, flanged: true });
  valveTag(s, 'MV-102', 910, M - 12);
  s.text('NC', 910, M + 17, { size: 5, align: 'center' });

  instrument(s, 980, R101.top, 298, 'PT', '201');
  psv(s, 1040, R101.top, 'PSV-201');
  vent(s, 1105, R101.top);
  instrument(s, 1050, R101.bottom, 420, 'PI', '201');
  drain(s, 1110, R101.bottom);
  valve(s, 985, 425, 'v', { closed: true });
  valveTag(s, 'MV-105', 996, 427, 'left', true);

  // Remaining line numbers and flow arrows
  lineLabel(s, '12"-EXP-010', 300, HDR - 5);
  arrow(s, 190, HDR, 'r');
  arrow(s, 300, HDR, 'r');
  arrow(s, 200, 235, 'd');
  lineLabel(s, '6"-EXP-011', 195, 305, 'right');
  arrow(s, 505, M, 'r');
  lineLabel(s, '12"-EXP-020', 930, OUT - 5);
  arrow(s, 1030, OUT, 'r');
  lineLabel(s, '8"-EXP-021', 980, 400, 'right');
}

const NOTES = [
  'ALL DIMENSIONS IN mm AND ELEVATIONS IN m ABOVE DATUM UNLESS NOTED OTHERWISE.',
  'PIPELINE 12"-EXP-001: API 5L X52 PSL2, OD 323.9 mm, WT 9.53 mm, 3LPE COATED. DESIGN PRESSURE 99 barg, DESIGN CODE ASME B31.4.',
  'STATION PIPEWORK INSIDE THE CODE BREAKS: ASME B31.3, PIPE CLASS A6B (ASME CLASS 600), WT 12.7 mm.',
  'PIPELINE HIGH POINT EL. +45.0 m AT KP 7+250. LOW POINT EL. +3.0 m AT KP 11+620. REFER TO ALIGNMENT SHEETS DEC-AL-2001 TO 2006.',
  'PSV-101 AND PSV-201 SET PRESSURE 99 barg.',
  'ALL VENTS AND DRAINS 2" WITH VALVE AND BLIND FLANGE. DRAINS ROUTED TO CLOSED DRAIN (CD).',
  'PIG SIGNALLERS XI-101 AND XI-201 SUPPLIED BY PIGGING VENDOR.',
  'INSULATING JOINTS IJ-101 AND IJ-201 MARK THE CATHODIC PROTECTION BOUNDARY.',
];

const REFERENCES: [string, string][] = [
  ['DEC-PID-0001', 'P&ID LEGEND AND SYMBOLS'],
  ['DEC-PID-1001', 'EXPORT PUMPS P-101A/B'],
  ['DEC-PID-3001', 'TERMINAL STORAGE T-301A/B'],
  ['DEC-AL-2001', 'PIPELINE ALIGNMENT SHEETS'],
  ['DEC-CP-2101', 'CATHODIC PROTECTION'],
];

const ABBREVIATIONS: [string, string][] = [
  ['AFC', 'APPROVED FOR CONSTRUCTION'],
  ['CD', 'CLOSED DRAIN'],
  ['IJ', 'INSULATING JOINT'],
  ['KP', 'KILOMETRE POINT'],
  ['NC', 'NORMALLY CLOSED'],
  ['QOC', 'QUICK OPENING CLOSURE'],
];

function drawNotes(s: Sheet) {
  const split = 410;
  s.line(split, DIAGRAM_BOTTOM, split, AREA.bottom, LW.grid);
  s.line(TB.left, DIAGRAM_BOTTOM, TB.left, AREA.bottom, LW.grid);

  const x = AREA.left + 8;
  let y = DIAGRAM_BOTTOM + 13;
  s.text('NOTES', x, y, { size: 7, font: 'bold' });
  y += 11;
  NOTES.forEach((note, i) => {
    s.text(`${i + 1}.`, x, y, { size: 6 });
    for (const line of s.wrap(note, split - x - 22, 6)) {
      s.text(line, x + 11, y, { size: 6 });
      y += 8.2;
    }
    y += 1.5;
  });

  const rx = split + 8;
  y = DIAGRAM_BOTTOM + 13;
  s.text('REFERENCE DRAWINGS', rx, y, { size: 7, font: 'bold' });
  y += 11;
  for (const [no, title] of REFERENCES) {
    s.text(no, rx, y, { size: 6 });
    s.text(title, rx + 62, y, { size: 6 });
    y += 9;
  }
  y += 10;
  s.text('ABBREVIATIONS', rx, y, { size: 7, font: 'bold' });
  y += 11;
  for (const [abbr, meaning] of ABBREVIATIONS) {
    s.text(abbr, rx, y, { size: 6 });
    s.text(meaning, rx + 62, y, { size: 6 });
    y += 9;
  }
}

function drawRevisions(s: Sheet) {
  const cols: [string, number][] = [
    ['REV', 35],
    ['DATE', 65],
    ['DESCRIPTION', 260],
    ['BY', 50],
    ['CHK', 50],
    ['APP', 50],
  ];
  const rows = [
    ['0', '20 AUG 2025', 'APPROVED FOR CONSTRUCTION', 'TB', 'KN', 'RE'],
    ['B', '02 MAY 2025', 'ISSUED FOR APPROVAL', 'TB', 'KN', 'RE'],
    ['A', '12 MAR 2025', 'ISSUED FOR REVIEW', 'TB', 'KN', ''],
    ['', '', '', '', '', ''],
  ];
  const headerH = 12;
  const rowH = 16;

  s.rect(REV.left, REV.top, REV.right - REV.left, REV.bottom - REV.top, { stroke: BLACK, width: LW.grid });
  let x = REV.left;
  for (const [, w] of cols.slice(0, -1)) {
    x += w;
    s.line(x, REV.top, x, REV.bottom, LW.thin);
  }
  s.line(REV.left, REV.top + headerH, REV.right, REV.top + headerH, LW.grid);
  rows.forEach((_, i) => {
    if (i > 0) s.line(REV.left, REV.top + headerH + i * rowH, REV.right, REV.top + headerH + i * rowH, LW.thin);
  });

  x = REV.left;
  cols.forEach(([label, w], c) => {
    s.text(label, x + 4, REV.top + 8.5, { size: 5.5, font: 'bold' });
    rows.forEach((row, r) => {
      if (row[c]) s.text(row[c], x + 4, REV.top + headerH + r * rowH + 10.5, { size: 6.5, font: c === 0 ? 'bold' : 'regular' });
    });
    x += w;
  });
}

function drawTitleBlock(s: Sheet) {
  const { left, right, top, bottom } = TB;
  const width = right - left;
  s.rect(left, top, width, bottom - top, { stroke: BLACK, width: LW.frame });

  // Row 1: client and project
  const r1 = top + 40;
  const logoRight = left + 165;
  s.line(left, r1, right, r1, LW.grid);
  s.line(logoRight, top, logoRight, r1, LW.thin);
  s.polygon([[left + 10, top + 31], [left + 22, top + 9], [left + 34, top + 31]], { fill: BLACK });
  s.polygon([[left + 17, top + 27.5], [left + 22, top + 18], [left + 27, top + 27.5]], { fill: WHITE });
  s.text('DELTA EXPORT CO.', left + 41, top + 20, { size: 9.5, font: 'bold' });
  s.text('OIL EXPORT FACILITIES', left + 41, top + 30, { size: 5.5 });
  s.text('PROJECT', logoRight + 6, top + 9, { size: 4.8 });
  s.text('DELTA EXPORT PIPELINE PROJECT', logoRight + 6, top + 20, { size: 8, font: 'bold' });
  s.text('FICTIONAL SAMPLE DRAWING FOR DEMONSTRATION ONLY', logoRight + 6, top + 32, { size: 5.5, font: 'oblique' });

  // Row 2: title
  const r2 = r1 + 50;
  s.line(left, r2, right, r2, LW.grid);
  s.text('TITLE', left + 6, r1 + 9, { size: 4.8 });
  const cx = left + width / 2;
  s.text('PIPING AND INSTRUMENTATION DIAGRAM', cx, r1 + 19, { size: 10, font: 'bold', align: 'center' });
  s.text('12" EXPORT LINE EXP-001', cx, r1 + 31, { size: 8.5, font: 'bold', align: 'center' });
  s.text('PIG LAUNCHER L-101 TO PIG RECEIVER R-101', cx, r1 + 42, { size: 7, align: 'center' });

  // Row 3: signatures
  const r3 = r2 + 32;
  s.line(left, r3, right, r3, LW.grid);
  const sign: [string, string][] = [
    ['DRAWN', 'T. BELLO'],
    ['CHECKED', 'K. NWOSU'],
    ['APPROVED', 'R. EZE'],
    ['DATE', '20 AUG 2025'],
    ['STATUS', 'AFC'],
  ];
  const signW = width / sign.length;
  sign.forEach(([label, value], i) => {
    const x = left + i * signW;
    if (i > 0) s.line(x, r2, x, r3, LW.thin);
    s.text(label, x + 6, r2 + 9, { size: 4.8 });
    s.text(value, x + 6, r2 + 23, { size: 7, font: 'bold' });
  });

  // Row 4: drawing number
  const cells: [string, string, number, number][] = [
    ['DRAWING NO.', 'DEC-EXP-PID-2001', 230, 12],
    ['REV', '0', 55, 12],
    ['SHEET', '1 OF 1', 75, 9],
    ['SCALE', 'NTS', 75, 9],
    ['SIZE', 'A3', 75, 9],
  ];
  let x = left;
  cells.forEach(([label, value, w, size], i) => {
    if (i > 0) s.line(x, r3, x, bottom, LW.thin);
    s.text(label, x + 6, r3 + 9, { size: 4.8 });
    s.text(value, x + 6, r3 + 30, { size, font: 'bold' });
    x += w;
  });
}

// ---------------------------------------------------------------------------

async function main() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle('DEC-EXP-PID-2001 Rev 0: P&ID 12in Export Line EXP-001');
  doc.setSubject('Pig launcher L-101 to pig receiver R-101. Fictional sample drawing for demonstration.');
  doc.setAuthor('Delta Export Co. (fictional)');
  doc.setCreator('GenSpec sample generator');
  doc.setProducer('pdf-lib');
  doc.setCreationDate(ISSUE_DATE);
  doc.setModificationDate(ISSUE_DATE);

  const page = doc.addPage([W, H]);
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const sheet = new Sheet(page, fonts);

  drawFrame(sheet);
  drawProcess(sheet);
  drawNotes(sheet);
  drawRevisions(sheet);
  drawTitleBlock(sheet);

  const bytes = await doc.save();

  mkdirSync(dirname(PDF_OUT), { recursive: true });
  writeFileSync(PDF_OUT, bytes);

  const base64 = Buffer.from(bytes).toString('base64');
  const chunks = base64.match(/.{1,120}/g) ?? [];
  writeFileSync(
    TS_OUT,
    [
      '// Generated by scripts/makeSamplePid.ts. Do not edit: run `npm run sample:pid` to rebuild.',
      '// Base64 copy of public/samples/sample-pid.pdf, seeded into the demo job so the demo works offline.',
      '',
      `export const SAMPLE_PID_FILE_NAME = '${CLIENT_FILE_NAME}';`,
      `export const SAMPLE_PID_PAGE_COUNT = ${doc.getPageCount()};`,
      'export const SAMPLE_PID_BASE64 = [',
      ...chunks.map((c) => `  '${c}',`),
      "].join('');",
      '',
    ].join('\n'),
  );

  console.log(`Wrote ${relative(ROOT, PDF_OUT)} (${(bytes.length / 1024).toFixed(1)} KB, A3 landscape)`);
  console.log(`Wrote ${relative(ROOT, TS_OUT)} (${(base64.length / 1024).toFixed(1)} KB base64)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

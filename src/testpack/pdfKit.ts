/**
 * Small drawing kit over pdf-lib, in top-left page coordinates (y down) like the
 * rest of GenSpec. Text is made safe for the standard fonts' WinAnsi encoding.
 */
import { type Color, LineCapStyle, type PDFFont, type PDFPage, type PDFPageDrawSVGOptions, rgb } from 'pdf-lib';

export const hex = (h: string): Color => {
  const n = Number.parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

export const COLORS = {
  ink: hex('#111827'),
  muted: hex('#5B6573'),
  faint: hex('#94A3B8'),
  line: hex('#CBD5E1'),
  rule: hex('#334155'),
  dark: hex('#0B1220'),
  white: rgb(1, 1, 1),
  zebra: hex('#F8FAFC'),
  markup: hex('#D7263D'),
  instrument: hex('#1F6FEB'),
  highlight: hex('#FFD60A'),
  amber: hex('#B45309'),
  amberFill: hex('#FEF3C7'),
  green: hex('#047857'),
  greenFill: hex('#D1FAE5'),
  red: hex('#B91C1C'),
  redFill: hex('#FEE2E2'),
};

export type Fonts = { regular: PDFFont; bold: PDFFont; mono: PDFFont; monoBold: PDFFont };
export type FontKey = keyof Fonts;
export type Align = 'left' | 'center' | 'right';

const REPLACE: Record<string, string> = {
  π: 'pi',
  Δ: 'd',
  '≈': '~',
  '≤': '<=',
  '≥': '>=',
  '−': '-',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '•': '-',
  ' ': ' ',
};

/** Keep text within the WinAnsi character set the standard PDF fonts can draw. */
export function winAnsi(text: string): string {
  let out = '';
  for (const ch of text) {
    const sub = REPLACE[ch];
    if (sub !== undefined) {
      out += sub;
      continue;
    }
    const c = ch.codePointAt(0) ?? 63;
    out += (c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff) ? ch : '?';
  }
  return out;
}

export type TextOptions = {
  size?: number;
  font?: FontKey;
  color?: Color;
  align?: Align;
  /** Shorten with "..." to fit. */
  maxWidth?: number;
  opacity?: number;
};

export type ShapeOptions = { fill?: Color; stroke?: Color; width?: number; opacity?: number; strokeOpacity?: number; dash?: number[] };

export class Canvas {
  readonly page: PDFPage;
  readonly fonts: Fonts;
  readonly width: number;
  readonly height: number;

  constructor(page: PDFPage, fonts: Fonts) {
    this.page = page;
    this.fonts = fonts;
    this.width = page.getWidth();
    this.height = page.getHeight();
  }

  measure(text: string, size: number, font: FontKey = 'regular'): number {
    return this.fonts[font].widthOfTextAtSize(winAnsi(text), size);
  }

  fit(text: string, maxWidth: number, size: number, font: FontKey = 'regular'): string {
    const safe = winAnsi(text);
    if (this.measure(safe, size, font) <= maxWidth) return safe;
    let cut = safe;
    while (cut.length > 1 && this.measure(`${cut}...`, size, font) > maxWidth) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}...`;
  }

  wrap(text: string, maxWidth: number, size: number, font: FontKey = 'regular'): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of winAnsi(text).split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && this.measure(next, size, font) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /** Text with its baseline at y. */
  text(text: string, x: number, y: number, o: TextOptions = {}) {
    const size = o.size ?? 9;
    const fontKey = o.font ?? 'regular';
    const str = o.maxWidth ? this.fit(text, o.maxWidth, size, fontKey) : winAnsi(text);
    if (!str) return;
    const w = this.measure(str, size, fontKey);
    const dx = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0;
    this.page.drawText(str, {
      x: x + dx,
      y: this.height - y,
      size,
      font: this.fonts[fontKey],
      color: o.color ?? COLORS.ink,
      opacity: o.opacity,
    });
  }

  rect(x: number, y: number, w: number, h: number, o: ShapeOptions = {}) {
    this.page.drawRectangle({
      x,
      y: this.height - y - h,
      width: w,
      height: h,
      color: o.fill,
      borderColor: o.stroke,
      borderWidth: o.stroke ? (o.width ?? 1) : 0,
      opacity: o.opacity,
      borderOpacity: o.strokeOpacity,
      borderDashArray: o.dash,
    });
  }

  line(x1: number, y1: number, x2: number, y2: number, o: { color?: Color; width?: number; dash?: number[]; opacity?: number } = {}) {
    this.page.drawLine({
      start: { x: x1, y: this.height - y1 },
      end: { x: x2, y: this.height - y2 },
      thickness: o.width ?? 0.8,
      color: o.color ?? COLORS.ink,
      dashArray: o.dash,
      opacity: o.opacity,
    });
  }

  circle(cx: number, cy: number, r: number, o: ShapeOptions = {}) {
    this.page.drawCircle({
      x: cx,
      y: this.height - cy,
      size: r,
      color: o.fill,
      borderColor: o.stroke,
      borderWidth: o.stroke ? (o.width ?? 1) : 0,
      opacity: o.opacity,
      borderOpacity: o.strokeOpacity,
    });
  }

  /** SVG path whose (0, 0) sits at (originX, originY) on the page, y down. */
  path(d: string, originX: number, originY: number, o: ShapeOptions & { round?: boolean } = {}) {
    const opts: PDFPageDrawSVGOptions = { x: originX, y: this.height - originY };
    if (o.fill) {
      opts.color = o.fill;
      if (o.opacity !== undefined) opts.opacity = o.opacity;
    }
    if (o.stroke) {
      opts.borderColor = o.stroke;
      opts.borderWidth = o.width ?? 1;
      if (o.strokeOpacity !== undefined) opts.borderOpacity = o.strokeOpacity;
      if (o.dash) opts.borderDashArray = o.dash;
      opts.borderLineCap = o.round ? LineCapStyle.Round : LineCapStyle.Butt;
    }
    this.page.drawSvgPath(d, opts);
  }
}

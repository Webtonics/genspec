/**
 * Text width from the standard Helvetica metrics (Arial is metric compatible).
 * The spread layout sizes its grid columns from these widths, so labels are
 * guaranteed room without measuring in a browser, and the layout is testable.
 */

// Advance widths in 1/1000 em for ASCII 32 to 126 (Helvetica AFM).
const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space to /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, // 0 to 9
  278, 278, 584, 584, 584, 556, 1015, // : to @
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, // A to M
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, // N to Z
  278, 278, 278, 469, 556, 333, // [ to `
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, // a to m
  556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, // n to z
  334, 260, 334, 584, // { to ~
];

/** Bold Helvetica runs about 6% wider on average. */
const BOLD_FACTOR = 1.06;

export function textWidth(text: string, size: number, bold = false): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? WIDTHS[code - 32] : 600;
  }
  return (units / 1000) * size * (bold ? BOLD_FACTOR : 1);
}

/** Greedy word wrap to a width. */
export function wrapText(text: string, maxWidth: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, bold) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

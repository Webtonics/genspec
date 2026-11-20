import type { ReadDrawingRequest } from '../../src/ai/types.js';

const MAX_TEXTS = 1500;
const MAX_CHARS = 60_000;

/** The PDF text layer as compact "text @ x,y" lines the model can cross-check against the image. */
export function textLayerSummary(texts: ReadDrawingRequest['texts']): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  let chars = 0;
  for (const t of texts.slice(0, MAX_TEXTS)) {
    const str = String(t?.str ?? '').replace(/\s+/g, ' ').trim();
    if (!str || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
    const line = `${str} @ ${Math.round(t.x)},${Math.round(t.y)}`;
    if (seen.has(line)) continue;
    if (chars + line.length > MAX_CHARS) break;
    seen.add(line);
    lines.push(line);
    chars += line.length + 1;
  }
  return lines.join('\n');
}

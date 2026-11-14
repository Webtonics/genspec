import type { Markup, MarkupType } from '@/model/types';

/** Auto tag formats per type, from CLAUDE.md: B1, V1, D1, F1, PI-101, PR-101, MV-1, J-001. */
const FORMATS: Record<MarkupType, (n: number) => string> = {
  boundary: (n) => `TL-${n}`,
  purgeRoute: (n) => `PRG-${n}`,
  blind: (n) => `B${n}`,
  vent: (n) => `V${n}`,
  drain: (n) => `D${n}`,
  fill: (n) => `F${n}`,
  gauge: (n) => `PI-${100 + n}`,
  recorder: (n) => `PR-${100 + n}`,
  valve: (n) => `MV-${n}`,
  joint: (n) => `J-${String(n).padStart(3, '0')}`,
};

export function autoTag(type: MarkupType, n: number): string {
  return FORMATS[type](n);
}

/**
 * Renumber auto tags per type in placement order, so deleting B2 of B1..B3 leaves
 * B1, B2. Locked tags (typed by the engineer or read from the drawing) are kept,
 * and auto numbering skips any tag a locked markup already uses.
 * Returns the same array when nothing changed.
 */
export function retag(markups: Markup[]): Markup[] {
  const taken = new Set(markups.filter((m) => m.tagLocked).map((m) => m.tag.toUpperCase()));
  const counters = new Map<MarkupType, number>();
  let changed = false;

  const next = markups.map((m) => {
    if (m.tagLocked) return m;
    let n = counters.get(m.type) ?? 0;
    let tag: string;
    do {
      n += 1;
      tag = autoTag(m.type, n);
    } while (taken.has(tag.toUpperCase()));
    counters.set(m.type, n);
    if (tag === m.tag) return m;
    changed = true;
    return { ...m, tag };
  });

  return changed ? next : markups;
}

/** The tag the next markup of this type would get. */
export function previewTag(markups: Markup[], type: MarkupType): string {
  const probe: Markup = { id: '__preview', type, page: 1, points: [], tag: '' };
  const tagged = retag([...markups, probe]);
  return tagged[tagged.length - 1].tag;
}

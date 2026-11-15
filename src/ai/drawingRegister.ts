/**
 * Ties the AI's drawing register back to the drawing: finds each tag in the PDF
 * text layer (so Locate points at the real label), maps suggestions to markup
 * tools, and checks which suggestions the engineer has already marked up.
 */
import type { DrawingText } from '@/markup/drawingText';
import type { Markup, MarkupType, Point } from '@/model/types';
import type { RuleSet } from '@/rules';
import type { TestCode } from '@/model/types';
import { type SectionValues, proposeSectionValues } from './jobDraft';
import type { DrawingRegister } from './types';

/** Upper case, no spaces, plain quotes and hyphens, so typographic variants of one tag compare equal. */
export function normalizeTag(s: string): string {
  return s
    .toUpperCase()
    .replace(/[\u2033\u201C\u201D\u02BA]|''/g, '"')
    .replace(/[\u2032\u2018\u2019]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, '');
}

const center = (t: DrawingText): Point => ({ x: t.x, y: t.y });

/**
 * Where a tag is printed, in page points. Tries an exact text run, then a word
 * within a run, then two or three runs side by side on one line (tags drawn in
 * pieces), then an instrument bubble (letters over number), then a run containing
 * the tag. null when the page has no such text.
 */
export function locateTag(tag: string, texts: DrawingText[]): Point | null {
  const want = normalizeTag(tag);
  if (!want) return null;
  const runs = texts.map((t) => ({ t, n: normalizeTag(t.str) }));

  const exact = runs.find((r) => r.n === want);
  if (exact) return center(exact.t);

  const word = runs.find((r) => r.t.str.toUpperCase().split(/[\s,;()]+/).some((w) => normalizeTag(w) === want));
  if (word) return center(word.t);

  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    let joined = normalizeTag(first.str);
    let last = first;
    for (let k = 1; k <= 2; k++) {
      const next = sorted
        .filter((t) => t !== last && Math.abs(t.y - first.y) <= Math.max(first.height, 1) / 2 && t.x > last.x)
        .sort((a, b) => a.x - b.x)[0];
      if (!next || next.x - next.width / 2 - (last.x + last.width / 2) > Math.max(first.height, 4) * 1.5) break;
      joined += normalizeTag(next.str);
      last = next;
      if (joined === want) return { x: (first.x - first.width / 2 + last.x + last.width / 2) / 2, y: first.y };
      if (!want.startsWith(joined)) break;
    }
  }

  // ISA instrument bubbles print the letters above the number: PI over 101 is PI-101.
  const bubble = /^([A-Z]{1,5})-?(\d{1,5}[A-Z]?)$/.exec(want);
  if (bubble) {
    const [, letters, number] = bubble;
    for (const top of runs) {
      if (top.n !== letters) continue;
      const reach = Math.max(top.t.height, 4) * 2.5;
      const below = runs.find(
        (r) =>
          r.n === number &&
          r.t.y > top.t.y &&
          r.t.y - top.t.y <= reach &&
          Math.abs(r.t.x - top.t.x) <= Math.max(top.t.width, r.t.width) / 2 + 4,
      );
      if (below) return { x: (top.t.x + below.t.x) / 2, y: (top.t.y + below.t.y) / 2 };
    }
  }

  if (want.length >= 4) {
    const partial = runs.find((r) => r.n.includes(want));
    if (partial) return center(partial.t);
  }
  return null;
}

export type SuggestionView = DrawingRegister['suggestions'][number] & {
  type: MarkupType;
  at: Point | null;
  done: boolean;
};

/** How close a markup must be to the suggested tag to count as done, in points. */
const DONE_DISTANCE = 90;

export function suggestionViews(register: DrawingRegister, texts: DrawingText[], markups: Markup[], page: number): SuggestionView[] {
  const onPage = markups.filter((m) => m.page === page);
  return register.suggestions.map((s) => {
    const at = s.nearTag ? locateTag(s.nearTag, texts) : null;
    const want = s.nearTag ? normalizeTag(s.nearTag) : '';
    const done = onPage.some((m) => {
      if (m.type !== s.action) return false;
      if (s.action === 'boundary') return true;
      if (s.action === 'valve' && want && normalizeTag(m.tag) === want) return true;
      if (!at) return false;
      return m.points.some((p) => Math.hypot(p.x - at.x, p.y - at.y) <= DONE_DISTANCE);
    });
    return { ...s, type: s.action, at, done };
  });
}

/** Design data from the drawing notes as section values (units converted, nothing filled from rules). */
export function designDataValues(register: DrawingRegister, code: TestCode, rules: RuleSet): { values: SectionValues; notes: string[] } {
  const d = register.designData;
  return proposeSectionValues(
    {
      name: d.lineTag,
      nps: null,
      od: d.pipeOd,
      wt: d.wallThickness,
      length: d.length,
      designPressure: d.designPressure,
      maxAllowableTest: null,
      highPointElevation: d.highPointElevation,
      lowPointElevation: d.lowPointElevation,
      hold: null,
    },
    { code, rules, fillFromRules: false },
  );
}

/** Total tagged items read from the page. */
export function registerCount(r: DrawingRegister): number {
  return r.lines.length + r.equipment.length + r.valves.length + r.instruments.length;
}

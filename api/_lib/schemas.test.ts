import { describe, expect, it } from 'vitest';
import { JOB_SCHEMA, REGISTER_SCHEMA } from './schemas';
import { textLayerSummary } from './textLayer';

type Node = Record<string, unknown>;

/** Every problem OpenAI strict mode would reject: objects must list all properties as required and forbid extras. */
function strictProblems(node: unknown, path = '$'): string[] {
  if (!node || typeof node !== 'object') return [];
  const n = node as Node;
  const out: string[] = [];
  const types = ([] as unknown[]).concat(n.type ?? []);
  if (types.includes('object')) {
    const props = (n.properties ?? {}) as Node;
    if (n.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`);
    const required = (n.required ?? []) as string[];
    const keys = Object.keys(props);
    if (required.length !== keys.length || keys.some((k) => !required.includes(k))) out.push(`${path}: required must list every property`);
    for (const k of keys) out.push(...strictProblems(props[k], `${path}.${k}`));
  }
  if (n.items) out.push(...strictProblems(n.items, `${path}[]`));
  if (Array.isArray(n.anyOf)) n.anyOf.forEach((s, i) => out.push(...strictProblems(s, `${path}|${i}`)));
  if (Array.isArray(n.enum) && types.includes('null') && !n.enum.includes(null)) out.push(`${path}: nullable enum must include null`);
  return out;
}

describe('AI response schemas', () => {
  it('meet OpenAI strict structured-output rules', () => {
    expect(strictProblems(JOB_SCHEMA)).toEqual([]);
    expect(strictProblems(REGISTER_SCHEMA)).toEqual([]);
  });

  it('have an object at the root', () => {
    expect(JOB_SCHEMA.type).toBe('object');
    expect(REGISTER_SCHEMA.type).toBe('object');
  });
});

describe('textLayerSummary', () => {
  it('rounds positions, drops blanks and duplicates', () => {
    const summary = textLayerSummary([
      { str: 'MV-101', x: 300.4, y: 199.6 },
      { str: '  ', x: 1, y: 1 },
      { str: 'MV-101', x: 300.2, y: 200.1 },
      { str: 'KV-101', x: Number.NaN, y: 3 },
    ]);
    expect(summary).toBe('MV-101 @ 300,200');
  });
});

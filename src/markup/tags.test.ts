import { describe, expect, it } from 'vitest';
import type { Markup, MarkupType } from '@/model/types';
import { createMarkup, deleteMarkup, updateMarkup } from './ops';
import { autoTag, previewTag, retag } from './tags';

const add = (markups: Markup[], type: MarkupType, tag?: string) =>
  createMarkup(markups, { type, page: 1, points: [{ x: 10, y: 10 }], tag }).markups;

const build = (...types: MarkupType[]) => types.reduce<Markup[]>((ms, t) => add(ms, t), []);
const tags = (markups: Markup[]) => markups.map((m) => m.tag);

describe('auto tag formats (CLAUDE.md)', () => {
  it.each([
    ['blind', 'B1'],
    ['vent', 'V1'],
    ['drain', 'D1'],
    ['fill', 'F1'],
    ['gauge', 'PI-101'],
    ['recorder', 'PR-101'],
    ['valve', 'MV-1'],
    ['joint', 'J-001'],
    ['boundary', 'TL-1'],
    ['purgeRoute', 'PRG-1'],
  ] as [MarkupType, string][])('%s starts at %s', (type, first) => {
    expect(autoTag(type, 1)).toBe(first);
  });

  it('counts per type in placement order', () => {
    const ms = build('blind', 'gauge', 'blind', 'joint', 'gauge', 'blind', 'joint');
    expect(tags(ms)).toEqual(['B1', 'PI-101', 'B2', 'J-001', 'PI-102', 'B3', 'J-002']);
  });
});

describe('renumbering', () => {
  it('closes the gap when a markup is deleted', () => {
    const ms = build('blind', 'blind', 'blind');
    const after = deleteMarkup(ms, ms[1].id);
    expect(tags(after)).toEqual(['B1', 'B2']);
    expect(after[1].id).toBe(ms[2].id);
  });

  it('only renumbers the type that changed', () => {
    const ms = build('blind', 'vent', 'blind', 'vent');
    const after = deleteMarkup(ms, ms[0].id);
    expect(tags(after)).toEqual(['V1', 'B1', 'V2']);
  });

  it('keeps a valve tag read from the drawing and numbers the rest MV-1..', () => {
    let ms = add([], 'valve', 'MV-101');
    ms = add(ms, 'valve');
    ms = add(ms, 'valve', 'KV-101');
    ms = add(ms, 'valve');
    expect(tags(ms)).toEqual(['MV-101', 'MV-1', 'KV-101', 'MV-2']);
    expect(ms[0].tagLocked).toBe(true);
    expect(tags(deleteMarkup(ms, ms[1].id))).toEqual(['MV-101', 'KV-101', 'MV-1']);
  });

  it('skips numbers a locked tag already uses', () => {
    let ms = add([], 'blind', 'B1');
    ms = add(ms, 'blind');
    expect(tags(ms)).toEqual(['B1', 'B2']);
  });

  it('a typed tag sticks; clearing it returns to auto numbering', () => {
    const ms = build('joint', 'joint');
    const typed = updateMarkup(ms, ms[0].id, { tag: 'FJ-17' });
    expect(tags(typed)).toEqual(['FJ-17', 'J-001']);
    const cleared = updateMarkup(typed, ms[0].id, { tag: '  ' });
    expect(tags(cleared)).toEqual(['J-001', 'J-002']);
    expect(cleared[0].tagLocked).toBeUndefined();
  });

  it('returns the same array when nothing changes', () => {
    const ms = build('blind', 'vent');
    expect(retag(ms)).toBe(ms);
  });

  it('previews the next tag without changing anything', () => {
    const ms = build('gauge', 'gauge');
    expect(previewTag(ms, 'gauge')).toBe('PI-103');
    expect(previewTag(ms, 'fill')).toBe('F1');
    expect(ms).toHaveLength(2);
  });
});

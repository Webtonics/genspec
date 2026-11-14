import { describe, expect, it } from 'vitest';
import type { Markup } from '@/model/types';
import { nearestTag, type DrawingText } from './drawingText';
import { cloudPath, dedupePoints, pointAlong, signedArea } from './geometry';
import {
  createMarkup,
  deleteMarkup,
  isPolylineType,
  moveVertex,
  nextRotation,
  toggleValvePosition,
  translateMarkup,
  updateMarkup,
} from './ops';

const PAGE = { width: 1190.55, height: 841.89 };

describe('createMarkup', () => {
  it('stores points rounded to 0.1 pt and starts valves closed', () => {
    const { markup } = createMarkup([], { type: 'valve', page: 1, points: [{ x: 410.04, y: 359.96 }] });
    expect(markup.points).toEqual([{ x: 410, y: 360 }]);
    expect(markup.valvePosition).toBe('closed');
    expect(markup.tag).toBe('MV-1');
  });

  it('assigns the section for new markups', () => {
    const { markup } = createMarkup([], { type: 'blind', page: 1, points: [{ x: 1, y: 1 }], sectionId: 'tp012' });
    expect(markup.sectionId).toBe('tp012');
  });

  it('does not give non-valves a valve position', () => {
    const { markup } = createMarkup([], { type: 'blind', page: 1, points: [{ x: 1, y: 1 }] });
    expect(markup.valvePosition).toBeUndefined();
  });
});

describe('editing', () => {
  const base = createMarkup([], { type: 'blind', page: 1, points: [{ x: 100, y: 100 }] }).markups;
  const id = base[0].id;

  it('moves a markup by a delta', () => {
    const moved = translateMarkup(base, id, { x: 20, y: -10 }, PAGE);
    expect(moved[0].points).toEqual([{ x: 120, y: 90 }]);
  });

  it('keeps a moved markup on the page', () => {
    const moved = translateMarkup(base, id, { x: -500, y: 5000 }, PAGE);
    // Clamped to the page edge, then stored to the nearest 0.1 pt.
    expect(moved[0].points[0].x).toBe(0);
    expect(moved[0].points[0].y).toBeCloseTo(PAGE.height, 1);
  });

  it('moves one vertex of a polyline', () => {
    const { markups } = createMarkup([], {
      type: 'boundary',
      page: 1,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    });
    const after = moveVertex(markups, markups[0].id, 1, { x: 20, y: 5 });
    expect(after[0].points[1]).toEqual({ x: 20, y: 5 });
    expect(after[0].points[0]).toEqual({ x: 0, y: 0 });
  });

  it('clears empty section and notes rather than storing blanks', () => {
    const withNotes = updateMarkup(base, id, { notes: 'Check rating', sectionId: 'tp012' });
    expect(withNotes[0]).toMatchObject({ notes: 'Check rating', sectionId: 'tp012' });
    const cleared = updateMarkup(withNotes, id, { notes: '', sectionId: undefined });
    expect(cleared[0].notes).toBeUndefined();
    expect(cleared[0].sectionId).toBeUndefined();
  });

  it('deleting an unknown id changes nothing but tags', () => {
    expect(deleteMarkup(base, 'nope')).toEqual(base);
  });
});

describe('valves and rotation', () => {
  it('the valve tool toggles open and closed', () => {
    expect(toggleValvePosition('closed')).toBe('open');
    expect(toggleValvePosition('open')).toBe('closed');
    expect(toggleValvePosition('locked closed')).toBe('open');
    expect(toggleValvePosition('locked open')).toBe('closed');
    expect(toggleValvePosition(undefined)).toBe('open');
  });

  it('rotation alternates 0 and 90', () => {
    expect(nextRotation(undefined)).toBe(90);
    expect(nextRotation(90)).toBe(0);
  });

  it('knows which types are polylines', () => {
    expect(isPolylineType('boundary')).toBe(true);
    expect(isPolylineType('purgeRoute')).toBe(true);
    expect(isPolylineType('valve')).toBe(false);
  });
});

describe('geometry', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it('signed area is positive for clockwise on screen', () => {
    expect(signedArea(square)).toBe(10000);
    expect(signedArea([...square].reverse())).toBe(-10000);
  });

  it('cloud arcs bulge outward whichever way the boundary was drawn', () => {
    expect(cloudPath(square, true)).toContain(' 0 0 1 ');
    expect(cloudPath([...square].reverse(), true)).toContain(' 0 0 0 ');
    expect(cloudPath(square, true).endsWith('Z')).toBe(true);
  });

  it('cloud uses about one arc per 12 pt of edge', () => {
    const arcs = cloudPath([{ x: 0, y: 0 }, { x: 120, y: 0 }], false).match(/A /g) ?? [];
    expect(arcs).toHaveLength(10);
  });

  it('drops the duplicate point a double-click leaves', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50.4, y: 0.2 },
    ];
    expect(dedupePoints(pts, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ]);
  });

  it('finds the midpoint and direction along a polyline', () => {
    const { point, angle } = pointAlong(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      0.5,
    );
    expect(point).toEqual({ x: 100, y: 0 });
    expect(angle).toBe(0);
    expect(pointAlong([{ x: 0, y: 0 }, { x: 0, y: 10 }], 1).angle).toBeCloseTo(Math.PI / 2, 9);
  });
});

describe('reading valve tags from the drawing', () => {
  // Text centres as drawn on the sample P&ID: tags sit 12 pt above each valve.
  const texts: DrawingText[] = [
    { str: 'MV-101', x: 410, y: 346, width: 22, height: 6 },
    { str: 'NC', x: 410, y: 375, width: 7, height: 5 },
    { str: '12"-EXP-001', x: 650, y: 353, width: 34, height: 6 },
    { str: 'KV-101', x: 221, y: 264, width: 22, height: 6 },
    { str: 'PI', x: 520, y: 260, width: 6, height: 6 },
  ];

  it('picks up the tag of the valve clicked on', () => {
    expect(nearestTag(texts, { x: 410, y: 360 })).toBe('MV-101');
    expect(nearestTag(texts, { x: 200, y: 268 })).toBe('KV-101');
  });

  it('ignores line numbers, instruments and far away tags', () => {
    expect(nearestTag(texts, { x: 650, y: 360 })).toBeUndefined();
    expect(nearestTag(texts, { x: 520, y: 262 })).toBeUndefined();
    expect(nearestTag(texts, { x: 600, y: 600 })).toBeUndefined();
  });
});

// Type check helper: a markup literal stays assignable with the optional fields.
const _sample: Markup = { id: 'x', type: 'joint', page: 1, points: [], tag: 'J-001', rotation: 90, tagLocked: true };
void _sample;

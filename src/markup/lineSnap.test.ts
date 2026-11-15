import { describe, expect, it } from 'vitest';
import { type Matrix, type PathOps, apply, multiply, segmentsFromOperatorList, snapToLine } from './lineSnap';

/** pdfjs-dist 4.x operator codes. */
const OPS: PathOps = {
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  constructPath: 91,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
};

/** PDF space (origin bottom left) to page points (origin top left) on an 800 pt tall page. */
const TO_PAGE: Matrix = [1, 0, 0, -1, 0, 800];

describe('matrix helpers', () => {
  it('applies the first matrix first', () => {
    const translate: Matrix = [1, 0, 0, 1, 10, 0];
    const scale: Matrix = [2, 0, 0, 2, 0, 0];
    expect(apply(multiply(translate, scale), 1, 1)).toEqual({ x: 22, y: 2 });
  });
});

describe('segmentsFromOperatorList', () => {
  it('follows transforms, save and restore, and flips into page points', () => {
    const segments = segmentsFromOperatorList(
      [OPS.save, OPS.transform, OPS.constructPath, OPS.restore, OPS.constructPath],
      [null, [1, 0, 0, 1, 100, 0], [[OPS.moveTo, OPS.lineTo], [0, 0, 50, 0]], null, [[OPS.moveTo, OPS.lineTo], [0, 10, 0, 60]]],
      OPS,
      TO_PAGE,
    );
    expect(segments).toEqual([
      { a: { x: 100, y: 800 }, b: { x: 150, y: 800 } },
      { a: { x: 0, y: 790 }, b: { x: 0, y: 740 } },
    ]);
  });

  it('turns rectangles into four sides and curves into chords, inside form XObjects', () => {
    const segments = segmentsFromOperatorList(
      [OPS.paintFormXObjectBegin, OPS.constructPath, OPS.paintFormXObjectEnd, OPS.constructPath],
      [
        [[2, 0, 0, 2, 0, 0], [0, 0, 100, 100]],
        [[OPS.rectangle], [10, 10, 20, 10]],
        null,
        [[OPS.moveTo, OPS.curveTo], [0, 0, 5, 5, 10, 5, 20, 0]],
      ],
      OPS,
      TO_PAGE,
    );
    expect(segments).toHaveLength(5);
    expect(segments[0]).toEqual({ a: { x: 20, y: 780 }, b: { x: 60, y: 780 } });
    expect(segments[4]).toEqual({ a: { x: 0, y: 800 }, b: { x: 20, y: 800 } });
  });
});

describe('snapToLine', () => {
  const page = { width: 1100, height: 800 };
  const pipe = { a: { x: 0, y: 100 }, b: { x: 300, y: 100 } };
  const tick = { a: { x: 50, y: 90 }, b: { x: 55, y: 90 } };
  const frame = { a: { x: 0, y: 10 }, b: { x: 1000, y: 10 } };
  const branch = { a: { x: 400, y: 100 }, b: { x: 400, y: 40 } };

  it('snaps to the nearest pipe, ignoring short strokes and the sheet frame', () => {
    expect(snapToLine({ x: 150, y: 85 }, [pipe, tick, frame], page)).toMatchObject({ point: { x: 150, y: 100 }, distance: 15, vertical: false });
    expect(snapToLine({ x: 52, y: 92 }, [tick], page)).toBeNull();
    expect(snapToLine({ x: 500, y: 14 }, [frame], page)).toBeNull();
  });

  it('reports vertical lines and gives up beyond the reach', () => {
    expect(snapToLine({ x: 385, y: 60 }, [pipe, branch], page)).toMatchObject({ point: { x: 400, y: 60 }, vertical: true });
    expect(snapToLine({ x: 150, y: 200 }, [pipe], page)).toBeNull();
  });
});

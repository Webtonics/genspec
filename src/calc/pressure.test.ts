import { describe, expect, it } from 'vitest';
import {
  amberThresholdBarg,
  highPointTestPressureBarg,
  lowPointTestPressureBarg,
  pressureFlag,
  staticHeadBar,
  worstFlag,
} from './pressure';

/*
 * Hand-worked: 12" export line TP-012, ASME B31.4 (factor 1.25), water
 *   Design 99 barg, max allowable 130 barg, high point 45 m, low point 3 m
 *   Static head  = 0.0981 x (45 - 3)  = 4.1202 bar
 *   P(HP)        = 1.25 x 99          = 123.75 barg
 *   P(LP)        = 123.75 + 4.1202    = 127.8702 barg
 *   AMBER from   = 0.95 x 130         = 123.50 barg
 *   127.87 is above 123.50 but not above 130.00, so AMBER (margin 2.13 bar)
 */
describe('static head', () => {
  it('42 m of water: 4.1202 bar', () => {
    expect(staticHeadBar(42, 0.0981)).toBeCloseTo(4.1202, 6);
  });

  it('10 m of water: 0.981 bar', () => {
    expect(staticHeadBar(10, 0.0981)).toBeCloseTo(0.981, 6);
  });

  it('no elevation difference: no head', () => {
    expect(staticHeadBar(0, 0.0981)).toBe(0);
  });
});

describe('test pressures', () => {
  it('B31.4 high point: 1.25 x 99 = 123.75 barg', () => {
    expect(highPointTestPressureBarg(99, 1.25)).toBeCloseTo(123.75, 9);
  });

  it('B31.3 high point: 1.5 x 99 = 148.5 barg', () => {
    expect(highPointTestPressureBarg(99, 1.5)).toBeCloseTo(148.5, 9);
  });

  it('low point: 123.75 + 4.1202 = 127.8702 barg', () => {
    expect(lowPointTestPressureBarg(123.75, 4.1202)).toBeCloseTo(127.8702, 9);
  });
});

describe('pressure flag', () => {
  it('TP-012: 127.87 barg against 130 barg is AMBER', () => {
    expect(amberThresholdBarg(130, 5)).toBeCloseTo(123.5, 9);
    expect(pressureFlag(127.8702, 130, 5)).toBe('AMBER');
  });

  it('RED when the low point exceeds the max allowable', () => {
    expect(pressureFlag(127.8702, 125, 5)).toBe('RED');
    expect(pressureFlag(130.01, 130, 5)).toBe('RED');
  });

  it('GREEN when more than 5% below the max allowable', () => {
    expect(pressureFlag(124.11, 148.5, 5)).toBe('GREEN');
    expect(pressureFlag(123.49, 130, 5)).toBe('GREEN');
  });

  it('boundaries: exactly at max allowable is AMBER, exactly 5% below is AMBER', () => {
    expect(pressureFlag(130, 130, 5)).toBe('AMBER');
    expect(pressureFlag(123.5, 130, 5)).toBe('AMBER');
  });

  it('follows an edited AMBER band', () => {
    expect(pressureFlag(127.8702, 130, 1)).toBe('GREEN');
    expect(pressureFlag(127.8702, 130, 2)).toBe('AMBER');
  });

  it('worstFlag picks the most severe', () => {
    expect(worstFlag(['GREEN', 'AMBER', 'GREEN'])).toBe('AMBER');
    expect(worstFlag(['GREEN', null, 'RED', 'AMBER'])).toBe('RED');
    expect(worstFlag([null, undefined])).toBeNull();
  });
});

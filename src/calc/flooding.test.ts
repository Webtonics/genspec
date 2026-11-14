import { describe, expect, it } from 'vitest';
import { fillTimeHours } from './flooding';
import { usGpmToM3PerHour } from './units';

/*
 * Hand-worked pump rates (1 US gal = 3.78541 L):
 *   1 US gpm       = 3.78541 x 60 / 1000 = 0.2271246 m3/h
 *   Flooding pump  = 3,150 x 0.2271246  = 715.44249 m3/h
 *   Lifting pump   = 6,000 x 0.2271246  = 1,362.7476 m3/h
 *
 * Hand-worked fill time, 12" x 9.53 mm WT x 12 km (V = 875.8204 m3):
 *   Flooding pump  = 875.8204 / 715.44249  = 1.2242 h (1 h 13 min)
 *   Lifting pump   = 875.8204 / 1,362.7476 = 0.6427 h (39 min)
 */
describe('pump rate conversion', () => {
  it('1 US gpm is 0.2271246 m3/h', () => {
    expect(usGpmToM3PerHour(1)).toBeCloseTo(0.2271246, 7);
  });

  it('GPPSL flooding pump, 3,150 US gpm: 715.44 m3/h', () => {
    expect(usGpmToM3PerHour(3150)).toBeCloseTo(715.44249, 5);
  });

  it('GPPSL lifting pump, 6,000 US gpm: 1,362.75 m3/h', () => {
    expect(usGpmToM3PerHour(6000)).toBeCloseTo(1362.7476, 4);
  });
});

describe('fill time', () => {
  const volume12km = 875.8203528;

  it('12 km line with the flooding pump: 1.22 h', () => {
    expect(fillTimeHours(volume12km, 715.44249)).toBeCloseTo(1.2242, 4);
  });

  it('12 km line with the lifting pump: 0.64 h', () => {
    expect(fillTimeHours(volume12km, 1362.7476)).toBeCloseTo(0.6427, 4);
  });

  it('halves when the pump rate doubles', () => {
    expect(fillTimeHours(100, 50)).toBe(2);
    expect(fillTimeHours(100, 100)).toBe(1);
  });
});

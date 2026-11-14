import { describe, expect, it } from 'vitest';
import { internalDiameterMm, internalVolumeM3 } from './geometry';

/*
 * Hand-worked: 12" line, OD 323.9 mm, WT 9.53 mm, 12 km
 *   ID   = 323.9 - 2 x 9.53            = 304.84 mm
 *   Area = pi/4 x 0.30484^2
 *        = 0.785398163 x 0.0929274256 = 0.0729850294 m2
 *   V    = 0.0729850294 x 12,000      = 875.820 m3
 *
 * Hand-worked: 12" station pipework, OD 323.9 mm, WT 12.7 mm, 180 m
 *   ID   = 323.9 - 25.4                = 298.5 mm
 *   Area = 0.785398163 x 0.08910225    = 0.0699807 m2
 *   V    = 0.0699807 x 180             = 12.597 m3
 *
 * Hand-worked: 8" line, OD 219.1 mm, WT 8.18 mm, 6.5 km
 *   ID   = 219.1 - 16.36               = 202.74 mm
 *   Area = 0.785398163 x 0.0411035076  = 0.0322826 m2
 *   V    = 0.0322826 x 6,500           = 209.837 m3
 */
describe('internal diameter', () => {
  it('12" x 9.53 mm WT: 304.84 mm', () => {
    expect(internalDiameterMm(323.9, 9.53)).toBeCloseTo(304.84, 6);
  });

  it('12" x 12.7 mm WT: 298.5 mm', () => {
    expect(internalDiameterMm(323.9, 12.7)).toBeCloseTo(298.5, 6);
  });

  it('8" x 8.18 mm WT: 202.74 mm', () => {
    expect(internalDiameterMm(219.1, 8.18)).toBeCloseTo(202.74, 6);
  });
});

describe('internal volume', () => {
  it('12" x 9.53 mm WT x 12 km: 875.82 m3', () => {
    expect(internalVolumeM3(304.84, 12000)).toBeCloseTo(875.82, 2);
  });

  it('12" x 12.7 mm WT x 180 m: 12.60 m3', () => {
    expect(internalVolumeM3(298.5, 180)).toBeCloseTo(12.597, 3);
  });

  it('8" x 8.18 mm WT x 6.5 km: 209.84 m3', () => {
    expect(internalVolumeM3(202.74, 6500)).toBeCloseTo(209.837, 3);
  });

  it('1 m of 1000 mm bore is pi/4 m3', () => {
    expect(internalVolumeM3(1000, 1)).toBeCloseTo(Math.PI / 4, 12);
  });

  it('scales linearly with length', () => {
    expect(internalVolumeM3(304.84, 24000)).toBeCloseTo(2 * internalVolumeM3(304.84, 12000), 9);
  });
});

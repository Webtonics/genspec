import { describe, expect, it } from 'vitest';
import { packingVolumeNm3, purgeVolumeM3 } from './nitrogen';

/*
 * Hand-worked, 12" x 9.53 mm WT x 12 km (V = 875.8204 m3):
 *   Purge, 3 volumes  = 875.8204 x 3                    = 2,627.46 m3
 *   Pack at 2 barg    = 875.8204 x (2 + 1.013) / 1.013
 *                     = 875.8204 x 2.974334             = 2,604.98 Nm3
 *
 * Hand-worked, 8" x 8.18 mm WT x 6.5 km (V = 209.8370 m3):
 *   Pack at 2 barg    = 209.8370 x 2.974334             = 624.13 Nm3
 */
const volume12km = 875.8203528;

describe('nitrogen purge volume', () => {
  it('3 line volumes of the 12 km line: 2,627.46 m3', () => {
    expect(purgeVolumeM3(volume12km, 3)).toBeCloseTo(2627.461, 3);
  });

  it('scales with the number of purge volumes', () => {
    expect(purgeVolumeM3(100, 5)).toBe(500);
  });
});

describe('nitrogen packing volume', () => {
  it('12 km line packed to 2 barg: 2,604.98 Nm3', () => {
    expect(packingVolumeNm3(volume12km, 2)).toBeCloseTo(2604.982, 3);
  });

  it('8" x 6.5 km line packed to 2 barg: 624.13 Nm3', () => {
    expect(packingVolumeNm3(209.837026, 2)).toBeCloseTo(624.125, 3);
  });

  it('at 0 barg the packing volume equals the line volume', () => {
    expect(packingVolumeNm3(volume12km, 0)).toBeCloseTo(volume12km, 9);
  });
});

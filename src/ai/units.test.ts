import { describe, expect, it } from 'vitest';
import { durationToHours, elevationToM, lengthToM, pressureToBarg, sizeToMm } from './units';

describe('pressureToBarg', () => {
  it('keeps barg as written', () => {
    expect(pressureToBarg({ value: 99, unit: 'barg' })).toEqual({ value: 99, source: '99 barg' });
  });

  it('converts psig with the working shown (1,440 psig x 0.0689476 = 99.28 barg)', () => {
    const r = pressureToBarg({ value: 1440, unit: 'psig' });
    expect(r.value).toBe(99.28);
    expect(r.working).toBe('1,440 psig x 0.0689476 = 99.28 barg');
    expect(r.note).toBeUndefined();
  });

  it('takes plain bar, psi, kPa and MPa as gauge and says so', () => {
    expect(pressureToBarg({ value: 10, unit: 'bar' })).toMatchObject({ value: 10, note: 'Pressure in bar taken as gauge.' });
    expect(pressureToBarg({ value: 100, unit: 'psi' })).toMatchObject({ value: 6.89, note: 'Pressure in psi taken as gauge.' });
    expect(pressureToBarg({ value: 9900, unit: 'kPa' }).value).toBe(99);
    expect(pressureToBarg({ value: 9.9, unit: 'MPa' }).value).toBe(99);
  });
});

describe('lengthToM', () => {
  it('converts the 12 km export line to 12,000 m', () => {
    const r = lengthToM({ value: 12, unit: 'km' });
    expect(r.value).toBe(12000);
    expect(r.working).toBe('12 km x 1,000 = 12,000 m');
  });

  it('converts feet and miles', () => {
    expect(lengthToM({ value: 1000, unit: 'ft' }).value).toBe(304.8);
    expect(lengthToM({ value: 2, unit: 'mi' }).value).toBe(3218.7);
  });
});

describe('sizeToMm', () => {
  it('converts inches to mm to 2 decimals (0.375 in WT = 9.53 mm)', () => {
    expect(sizeToMm({ value: 0.375, unit: 'in' }).value).toBe(9.53);
    expect(sizeToMm({ value: 323.9, unit: 'mm' })).toEqual({ value: 323.9, source: '323.9 mm' });
  });
});

describe('elevationToM and durationToHours', () => {
  it('converts feet elevations, keeps negative (below datum) values', () => {
    expect(elevationToM({ value: 150, unit: 'ft' }).value).toBe(45.72);
    expect(elevationToM({ value: -2.5, unit: 'm' }).value).toBe(-2.5);
  });

  it('converts minutes to hours', () => {
    expect(durationToHours({ value: 10, unit: 'min' })).toMatchObject({ value: 0.167, working: '10 min / 60 = 0.167 h' });
    expect(durationToHours({ value: 4, unit: 'h' }).value).toBe(4);
  });
});

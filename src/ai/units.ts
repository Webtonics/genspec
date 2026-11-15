/**
 * Converts quantities the AI read ("12 km", "1,440 psig") into the units the job
 * model uses. Deterministic and unit tested: the model never converts anything.
 */
import { fmtValue } from '@/lib/format';
import type { DurationUnit, ElevationUnit, LengthUnit, PressureUnit, SizeUnit } from './types';

/** A value in model units, where it came from, and the conversion if one was needed. */
export type Converted = { value: number; source: string; working?: string; note?: string };

type Q<U extends string> = { value: number; unit: U };

export const PSI_TO_BAR = 0.0689475729;
export const FT_TO_M = 0.3048;
export const MILE_TO_M = 1609.344;
export const IN_TO_MM = 25.4;

/** Half-up rounding that survives binary floats: 0.375 x 25.4 is 9.52499... in floating point, and should give 9.53. */
const round = (value: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(Number((value * f).toPrecision(12))) / f;
};

const source = (q: Q<string>) => `${fmtValue(q.value)} ${q.unit}`;

function scaled(q: Q<string>, factor: number, factorText: string, toUnit: string, decimals: number, note?: string): Converted {
  const value = round(q.value * factor, decimals);
  return { value, source: source(q), working: `${source(q)} x ${factorText} = ${fmtValue(value)} ${toUnit}`, note };
}

const GAUGE_NOTE = (unit: string) => `Pressure in ${unit} taken as gauge.`;

/** To barg. Plain bar, psi, kPa and MPa are taken as gauge, and say so. */
export function pressureToBarg(q: Q<PressureUnit>): Converted {
  switch (q.unit) {
    case 'barg':
      return { value: q.value, source: source(q) };
    case 'bar':
      return { value: q.value, source: source(q), note: GAUGE_NOTE('bar') };
    case 'psig':
      return scaled(q, PSI_TO_BAR, '0.0689476', 'barg', 2);
    case 'psi':
      return scaled(q, PSI_TO_BAR, '0.0689476', 'barg', 2, GAUGE_NOTE('psi'));
    case 'kPa':
      return scaled(q, 0.01, '0.01', 'barg', 2, GAUGE_NOTE('kPa'));
    case 'MPa':
      return scaled(q, 10, '10', 'barg', 2, GAUGE_NOTE('MPa'));
  }
}

/** To metres, for line lengths. */
export function lengthToM(q: Q<LengthUnit>): Converted {
  switch (q.unit) {
    case 'm':
      return { value: q.value, source: source(q) };
    case 'km':
      return scaled(q, 1000, '1,000', 'm', 1);
    case 'ft':
      return scaled(q, FT_TO_M, '0.3048', 'm', 1);
    case 'mi':
      return scaled(q, MILE_TO_M, '1,609.344', 'm', 1);
  }
}

/** To millimetres, for diameters and wall thickness. */
export function sizeToMm(q: Q<SizeUnit>): Converted {
  return q.unit === 'mm' ? { value: q.value, source: source(q) } : scaled(q, IN_TO_MM, '25.4', 'mm', 2);
}

/** To metres above datum. */
export function elevationToM(q: Q<ElevationUnit>): Converted {
  return q.unit === 'm' ? { value: q.value, source: source(q) } : scaled(q, FT_TO_M, '0.3048', 'm', 2);
}

/** To hours. */
export function durationToHours(q: Q<DurationUnit>): Converted {
  if (q.unit === 'h') return { value: q.value, source: source(q) };
  const value = round(q.value / 60, 3);
  return { value, source: source(q), working: `${source(q)} / 60 = ${fmtValue(value)} h` };
}

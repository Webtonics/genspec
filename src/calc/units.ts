/** 1 US gallon in litres. */
export const LITRES_PER_US_GALLON = 3.78541;

/** Atmospheric pressure used to convert gauge to absolute, bar. */
export const ATMOSPHERIC_BAR = 1.013;

/** US gallons per minute to cubic metres per hour: gpm x 3.78541 L x 60 min / 1000 L. */
export function usGpmToM3PerHour(usGpm: number): number {
  return (usGpm * LITRES_PER_US_GALLON * 60) / 1000;
}

/**
 * Outside diameter (mm) by nominal pipe size (in), from ASME B36.10M. Used to
 * fill in the OD when a section's NPS is chosen; the engineer can still override it.
 */
export const NPS_OD_MM: Record<number, number> = {
  0.5: 21.3,
  0.75: 26.7,
  1: 33.4,
  1.5: 48.3,
  2: 60.3,
  3: 88.9,
  4: 114.3,
  6: 168.3,
  8: 219.1,
  10: 273.1,
  12: 323.9,
  14: 355.6,
  16: 406.4,
  18: 457,
  20: 508,
  24: 610,
  28: 711,
  30: 762,
  32: 813,
  36: 914,
  40: 1016,
  42: 1067,
  48: 1219,
};

export const standardOd = (nps: number): number | undefined => NPS_OD_MM[nps];

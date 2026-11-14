export type PressureRules = {
  /** Static head gradient of the test water, bar per metre of elevation (water at 1000 kg/m3). */
  waterGradientBarPerM: number;
  /** Flag AMBER when the low point test pressure is within this percentage of the max allowable. */
  amberWithinPct: number;
};

export const DEFAULT_PRESSURE_RULES: PressureRules = {
  waterGradientBarPerM: 0.0981,
  amberWithinPct: 5,
};

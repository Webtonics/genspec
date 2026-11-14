export type PumpPreset = {
  id: string;
  name: string;
  /** Rated flow, US gallons per minute. */
  ratedUsGpm: number;
};

/** GPPSL pump fleet used for fill time calculations. */
export const DEFAULT_PUMP_PRESETS: PumpPreset[] = [
  { id: 'gppsl-flooding', name: 'GPPSL flooding pump', ratedUsGpm: 3150 },
  { id: 'gppsl-lifting', name: 'GPPSL lifting pump', ratedUsGpm: 6000 },
];

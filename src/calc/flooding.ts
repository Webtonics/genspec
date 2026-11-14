/** Fill time (h) = volume / pump rate (m3/h), at rated flow with no efficiency allowance. */
export function fillTimeHours(volumeM3: number, pumpRateM3PerHour: number): number {
  return volumeM3 / pumpRateM3PerHour;
}

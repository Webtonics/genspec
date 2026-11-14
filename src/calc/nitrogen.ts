import { ATMOSPHERIC_BAR } from './units';

/** Nitrogen purge volume (m3, approx) = line volume x purge volumes, at near atmospheric pressure. */
export function purgeVolumeM3(lineVolumeM3: number, purgeVolumes: number): number {
  return lineVolumeM3 * purgeVolumes;
}

/** Nitrogen packing volume (Nm3, approx) = line volume x (packing pressure barg + 1.013) / 1.013 */
export function packingVolumeNm3(lineVolumeM3: number, packingPressureBarg: number): number {
  return (lineVolumeM3 * (packingPressureBarg + ATMOSPHERIC_BAR)) / ATMOSPHERIC_BAR;
}

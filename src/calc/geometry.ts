/** ID (mm) = OD - 2 x WT */
export function internalDiameterMm(odMm: number, wtMm: number): number {
  return odMm - 2 * wtMm;
}

/** Internal volume (m3) = pi/4 x (ID/1000)^2 x length */
export function internalVolumeM3(idMm: number, lengthM: number): number {
  return (Math.PI / 4) * (idMm / 1000) ** 2 * lengthM;
}

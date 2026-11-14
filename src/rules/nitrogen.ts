export type NitrogenRules = {
  /** Line volumes of nitrogen swept through for a purge, at near atmospheric pressure. */
  purgeVolumes: number;
  /** Nitrogen packing (preservation) pressure, barg. */
  packingPressureBarg: number;
};

/** Company defaults. Each job can override them on the Calculations page. */
export const DEFAULT_NITROGEN_RULES: NitrogenRules = {
  purgeVolumes: 3,
  packingPressureBarg: 2,
};

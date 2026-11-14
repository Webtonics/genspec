export type TitleBlockSettings = {
  /** Company name in every title block. */
  company: string;
  /** Short line under the company name. */
  tagline: string;
  /**
   * Document number pattern. Tokens: {job} job number, {type} document type code
   * (TP test pack, SPD spread diagram), {nn} two digit sequence.
   */
  documentFormat: string;
};

export const DEFAULT_TITLE_BLOCK: TitleBlockSettings = {
  company: 'GPPSL',
  tagline: 'Process and pipeline services',
  documentFormat: '{job}-{type}-{nn}',
};

export function documentNumber(format: string, jobNo: string, type: string, n: number): string {
  const pattern = format.trim() || DEFAULT_TITLE_BLOCK.documentFormat;
  return pattern
    .replaceAll('{job}', jobNo)
    .replaceAll('{type}', type)
    .replaceAll('{nn}', String(n).padStart(2, '0'));
}

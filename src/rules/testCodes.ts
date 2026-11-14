import type { TestCode } from '@/model/types';

export type TestCodeRule = {
  /** Minimum test pressure at the high point = factor x design pressure. null: enter it from the client specification. */
  factor: number | null;
  /** Minimum hold at test pressure, minutes. null: per client. */
  minHoldMinutes: number | null;
  /** What the rule represents, shown beside it. */
  basis: string;
};

export type TestCodeRules = Record<TestCode, TestCodeRule>;

/** Shipped defaults. Every value is editable in Settings and marked "Default, confirm with engineer". */
export const DEFAULT_TEST_CODE_RULES: TestCodeRules = {
  'ASME B31.3': {
    factor: 1.5,
    minHoldMinutes: 10,
    basis: 'Hydrostatic leak test at 1.5 x design pressure, minimum hold 10 min.',
  },
  'ASME B31.4': {
    factor: 1.25,
    minHoldMinutes: 4 * 60,
    basis: 'Hydrostatic test at 1.25 x design pressure, hold 4 h.',
  },
  'ASME B31.8': {
    factor: 1.25,
    minHoldMinutes: null,
    basis: 'Factor depends on location class. Hold period per client.',
  },
  'Client spec': {
    factor: null,
    minHoldMinutes: null,
    basis: 'Factor and hold period entered from the client specification.',
  },
};

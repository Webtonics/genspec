import { DEFAULT_NITROGEN_RULES, type NitrogenRules } from './nitrogen';
import { DEFAULT_PRESSURE_RULES, type PressureRules } from './pressure';
import { DEFAULT_PUMP_PRESETS, type PumpPreset } from './pumps';
import { DEFAULT_TEST_CODE_RULES, type TestCodeRules } from './testCodes';

export type { NitrogenRules } from './nitrogen';
export type { PressureRules } from './pressure';
export type { PumpPreset } from './pumps';
export type { TestCodeRule, TestCodeRules } from './testCodes';

/** Label shown beside every rule value that is still at its shipped default. */
export const RULE_DEFAULT_LABEL = 'Default, confirm with engineer';

/** Every engineering rule value the calculations use. Editable in Settings. */
export type RuleSet = {
  testCodes: TestCodeRules;
  pressure: PressureRules;
  pumps: PumpPreset[];
  nitrogen: NitrogenRules;
};

export const DEFAULT_RULES: RuleSet = {
  testCodes: DEFAULT_TEST_CODE_RULES,
  pressure: DEFAULT_PRESSURE_RULES,
  pumps: DEFAULT_PUMP_PRESETS,
  nitrogen: DEFAULT_NITROGEN_RULES,
};

/** A deep copy of the defaults, safe to edit. */
export function makeDefaultRules(): RuleSet {
  return structuredClone(DEFAULT_RULES);
}

/** The shipped default for a pump preset, if it is one of the defaults. */
export function defaultPump(id: string): PumpPreset | undefined {
  return DEFAULT_RULES.pumps.find((p) => p.id === id);
}

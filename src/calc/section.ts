/**
 * Calculation of one test section with the working shown.
 *
 * Deterministic: every number comes from the formula modules in this folder and
 * the rule tables in src/rules. The structured working (formula, substituted
 * values, result) is what the Calculations page and the test pack print, so an
 * engineer can check each figure by hand.
 */
import { fmtHours, fmtMinutes, fmtNumber, fmtValue } from '@/lib/format';
import type { Job, JobCalcOptions, Medium, TestCode, TestSection } from '@/model/types';
import { DEFAULT_RULES, type PumpPreset, type RuleSet, defaultPump } from '@/rules';
import { fillTimeHours } from './flooding';
import { internalDiameterMm, internalVolumeM3 } from './geometry';
import { packingVolumeNm3, purgeVolumeM3 } from './nitrogen';
import {
  type Flag,
  amberThresholdBarg,
  highPointTestPressureBarg,
  lowPointTestPressureBarg,
  pressureFlag,
  staticHeadBar,
  worstFlag,
} from './pressure';
import { ATMOSPHERIC_BAR, LITRES_PER_US_GALLON, usGpmToM3PerHour } from './units';

// ---------------------------------------------------------------------------
// Result types

/** One line of working: formula, the same formula with values substituted, and the result. */
export type CalcStep = {
  key: string;
  label: string;
  formula: string;
  substitution: string;
  value: number;
  unit: string;
  decimals: number;
  note?: string;
};

export type CalcGroupKey = 'geometry' | 'flooding' | 'pressure' | 'nitrogen';

export type CalcGroup = { key: CalcGroupKey; title: string; steps: CalcStep[]; notes: string[] };

/** Where an input came from: the section in Job setup, a rule table in Settings, or a per-job choice. */
export type InputSource = 'section' | 'rule' | 'job';

export type CalcInput = {
  key: string;
  label: string;
  symbol: string;
  value: number | null;
  unit: string;
  source: InputSource;
  /** For rule inputs: the value is still the shipped default ("Default, confirm with engineer"). */
  ruleDefault?: boolean;
};

export type FlagResult = {
  flag: Flag;
  lowPointBarg: number;
  maxAllowableBarg: number;
  amberFromBarg: number;
  marginBar: number;
  message: string;
};

export type HoldCheck = {
  actualHours: number;
  minimumMinutes: number | null;
  /** null when the code leaves the hold period to the client. */
  ok: boolean | null;
  message: string;
};

export type SectionValues = {
  idMm?: number;
  volumeM3?: number;
  pumpRateM3h?: number;
  fillTimeHours?: number;
  elevationDiffM?: number;
  staticHeadBar?: number;
  highPointBarg?: number;
  lowPointBarg?: number;
  purgeVolumeM3?: number;
  packingVolumeNm3?: number;
};

export type SectionCalc = {
  sectionId: string;
  name: string;
  inputs: CalcInput[];
  groups: CalcGroup[];
  values: SectionValues;
  flag: FlagResult | null;
  hold: HoldCheck | null;
  /** Missing or invalid inputs that stopped part of the calculation. */
  issues: string[];
};

export type ResolvedCalcOptions = {
  pump: PumpPreset | undefined;
  purgeVolumes: number;
  packingPressureBarg: number;
  /** True where the value is the Settings default rather than a choice made for this job. */
  fromDefaults: { pump: boolean; purgeVolumes: boolean; packingPressureBarg: boolean };
};

export type CalcContext = {
  medium: Medium;
  code: TestCode;
  rules: RuleSet;
  options: ResolvedCalcOptions;
};

export type JobCalc = {
  options: ResolvedCalcOptions;
  sections: SectionCalc[];
  /** Most severe flag across sections that could be calculated. */
  worst: Flag | null;
};

// ---------------------------------------------------------------------------

/** Fill in per-job choices from the rule defaults. */
export function resolveCalcOptions(options: JobCalcOptions | undefined, rules: RuleSet): ResolvedCalcOptions {
  const chosenPump = options?.pumpId ? rules.pumps.find((p) => p.id === options.pumpId) : undefined;
  return {
    pump: chosenPump ?? rules.pumps[0],
    purgeVolumes: options?.purgeVolumes ?? rules.nitrogen.purgeVolumes,
    packingPressureBarg: options?.packingPressureBarg ?? rules.nitrogen.packingPressureBarg,
    fromDefaults: {
      pump: !chosenPump,
      purgeVolumes: options?.purgeVolumes === undefined,
      packingPressureBarg: options?.packingPressureBarg === undefined,
    },
  };
}

const v = (n: number) => fmtValue(n);
const f = (n: number, decimals: number) => fmtNumber(n, decimals);
const isPositive = (n: number) => Number.isFinite(n) && n > 0;

export function calculateSection(section: TestSection, ctx: CalcContext): SectionCalc {
  const { rules, options, medium, code } = ctx;
  const codeRule = rules.testCodes[code];
  const defaults = DEFAULT_RULES;
  const isWater = medium === 'inhibited water';
  const { odMm, wtMm, lengthM, designPressureBarg, maxAllowableTestBarg, highPointElevM, lowPointElevM } = section;

  const issues: string[] = [];
  const groups: CalcGroup[] = [];
  const values: SectionValues = {};
  let flag: FlagResult | null = null;

  // Inputs, with where each one comes from -------------------------------------------------
  const pump = options.pump;
  const pumpDefault = pump ? defaultPump(pump.id) : undefined;
  const inputs: CalcInput[] = [
    { key: 'od', label: 'Outside diameter', symbol: 'OD', value: odMm, unit: 'mm', source: 'section' },
    { key: 'wt', label: 'Wall thickness', symbol: 'WT', value: wtMm, unit: 'mm', source: 'section' },
    { key: 'length', label: 'Length', symbol: 'L', value: lengthM, unit: 'm', source: 'section' },
    { key: 'design', label: 'Design pressure', symbol: 'P(design)', value: designPressureBarg, unit: 'barg', source: 'section' },
    { key: 'max', label: 'Max allowable test pressure', symbol: 'P(max)', value: maxAllowableTestBarg, unit: 'barg', source: 'section' },
    { key: 'hp', label: 'High point elevation', symbol: 'EL(HP)', value: highPointElevM, unit: 'm', source: 'section' },
    { key: 'lp', label: 'Low point elevation', symbol: 'EL(LP)', value: lowPointElevM, unit: 'm', source: 'section' },
    { key: 'hold', label: 'Hold period', symbol: 't(hold)', value: section.holdHours, unit: 'h', source: 'section' },
    {
      key: 'factor',
      label: `Test factor, ${code}`,
      symbol: 'k',
      value: codeRule.factor,
      unit: 'x design',
      source: 'rule',
      ruleDefault: codeRule.factor === defaults.testCodes[code].factor,
    },
    {
      key: 'minHold',
      label: `Minimum hold, ${code}`,
      symbol: 't(min)',
      value: codeRule.minHoldMinutes,
      unit: 'min',
      source: 'rule',
      ruleDefault: codeRule.minHoldMinutes === defaults.testCodes[code].minHoldMinutes,
    },
    ...(isWater
      ? [
          {
            key: 'gradient',
            label: 'Static head gradient, water',
            symbol: 'g',
            value: rules.pressure.waterGradientBarPerM,
            unit: 'bar/m',
            source: 'rule' as const,
            ruleDefault: rules.pressure.waterGradientBarPerM === defaults.pressure.waterGradientBarPerM,
          },
        ]
      : []),
    {
      key: 'amber',
      label: 'AMBER band below max allowable',
      symbol: 'a',
      value: rules.pressure.amberWithinPct,
      unit: '%',
      source: 'rule',
      ruleDefault: rules.pressure.amberWithinPct === defaults.pressure.amberWithinPct,
    },
    ...(isWater && pump
      ? [
          {
            key: 'pumpFlow',
            label: `Rated flow, ${pump.name}`,
            symbol: 'Q(rated)',
            value: pump.ratedUsGpm,
            unit: 'US gpm',
            source: 'rule' as const,
            ruleDefault: pumpDefault !== undefined && pump.ratedUsGpm === pumpDefault.ratedUsGpm,
          },
        ]
      : []),
    {
      key: 'purgeVolumes',
      label: 'Nitrogen purge volumes',
      symbol: 'n',
      value: options.purgeVolumes,
      unit: 'x line volume',
      source: options.fromDefaults.purgeVolumes ? 'rule' : 'job',
      ruleDefault: options.purgeVolumes === defaults.nitrogen.purgeVolumes,
    },
    {
      key: 'packing',
      label: 'Nitrogen packing pressure',
      symbol: 'P(pack)',
      value: options.packingPressureBarg,
      unit: 'barg',
      source: options.fromDefaults.packingPressureBarg ? 'rule' : 'job',
      ruleDefault: options.packingPressureBarg === defaults.nitrogen.packingPressureBarg,
    },
  ];

  // Line geometry --------------------------------------------------------------------------
  if (!isPositive(odMm)) issues.push('Outside diameter must be greater than zero.');
  if (!isPositive(wtMm)) issues.push('Wall thickness must be greater than zero.');
  else if (isPositive(odMm) && wtMm >= odMm / 2) issues.push('Wall thickness must be less than half the outside diameter.');
  if (!isPositive(lengthM)) issues.push('Length must be greater than zero.');

  const geometryOk = isPositive(odMm) && isPositive(wtMm) && wtMm < odMm / 2 && isPositive(lengthM);
  if (geometryOk) {
    const id = internalDiameterMm(odMm, wtMm);
    const volume = internalVolumeM3(id, lengthM);
    values.idMm = id;
    values.volumeM3 = volume;
    groups.push({
      key: 'geometry',
      title: 'Line geometry',
      notes: [],
      steps: [
        {
          key: 'id',
          label: 'Internal diameter',
          formula: 'ID = OD - 2 × WT',
          substitution: `${v(odMm)} - 2 × ${v(wtMm)}`,
          value: id,
          unit: 'mm',
          decimals: 2,
        },
        {
          key: 'volume',
          label: 'Internal volume',
          formula: 'V = π/4 × (ID ÷ 1000)² × L',
          substitution: `π/4 × (${f(id, 2)} ÷ 1000)² × ${v(lengthM)}`,
          value: volume,
          unit: 'm³',
          decimals: 2,
        },
      ],
    });
  }

  // Flooding (water only) ------------------------------------------------------------------
  if (isWater && values.volumeM3 !== undefined) {
    if (!pump || !isPositive(pump.ratedUsGpm)) {
      issues.push('Choose a pump with a rated flow to calculate the fill time.');
    } else {
      const rate = usGpmToM3PerHour(pump.ratedUsGpm);
      const hours = fillTimeHours(values.volumeM3, rate);
      values.pumpRateM3h = rate;
      values.fillTimeHours = hours;
      groups.push({
        key: 'flooding',
        title: 'Flooding',
        notes: [],
        steps: [
          {
            key: 'pumpRate',
            label: `Pump rate, ${pump.name}`,
            formula: `Q = Q(rated) × ${v(LITRES_PER_US_GALLON)} L/gal × 60 min/h ÷ 1000 L/m³`,
            substitution: `${v(pump.ratedUsGpm)} × ${v(LITRES_PER_US_GALLON)} × 60 ÷ 1000`,
            value: rate,
            unit: 'm³/h',
            decimals: 1,
          },
          {
            key: 'fillTime',
            label: 'Fill time',
            formula: 't(fill) = V ÷ Q',
            substitution: `${f(values.volumeM3, 2)} ÷ ${f(rate, 1)}`,
            value: hours,
            unit: 'h',
            decimals: 2,
            note: `About ${fmtHours(hours)} at rated flow, with no allowance for pump efficiency.`,
          },
        ],
      });
    }
  }

  // Test pressure and flag -----------------------------------------------------------------
  const factor = codeRule.factor;
  if (factor === null || !isPositive(factor)) issues.push(`Enter the ${code} test factor in Settings.`);
  if (!isPositive(designPressureBarg)) issues.push('Design pressure must be greater than zero.');
  if (!isPositive(maxAllowableTestBarg)) issues.push('Max allowable test pressure must be greater than zero.');
  const elevationsOk = Number.isFinite(highPointElevM) && Number.isFinite(lowPointElevM);
  if (!elevationsOk) issues.push('Enter the high and low point elevations.');
  else if (highPointElevM < lowPointElevM) issues.push('High point elevation is below the low point elevation.');

  if (
    factor !== null &&
    isPositive(factor) &&
    isPositive(designPressureBarg) &&
    isPositive(maxAllowableTestBarg) &&
    elevationsOk &&
    highPointElevM >= lowPointElevM
  ) {
    const { waterGradientBarPerM: gradient, amberWithinPct: amberPct } = rules.pressure;
    const dh = highPointElevM - lowPointElevM;
    const head = isWater ? staticHeadBar(dh, gradient) : 0;
    const pHigh = highPointTestPressureBarg(designPressureBarg, factor);
    const pLow = lowPointTestPressureBarg(pHigh, head);
    const amberFrom = amberThresholdBarg(maxAllowableTestBarg, amberPct);
    const margin = maxAllowableTestBarg - pLow;
    Object.assign(values, { elevationDiffM: dh, staticHeadBar: head, highPointBarg: pHigh, lowPointBarg: pLow });

    groups.push({
      key: 'pressure',
      title: isWater ? 'Hydrostatic test pressure' : 'Test pressure',
      notes: isWater
        ? []
        : ['The rule table factor is for hydrostatic tests. Confirm the pneumatic test factor with the engineer.'],
      steps: [
        {
          key: 'elevationDiff',
          label: 'Elevation difference',
          formula: 'Δh = EL(HP) - EL(LP)',
          substitution: `${v(highPointElevM)} - ${v(lowPointElevM)}`,
          value: dh,
          unit: 'm',
          decimals: 2,
        },
        isWater
          ? {
              key: 'head',
              label: 'Static head',
              formula: 'P(head) = g × Δh',
              substitution: `${v(gradient)} × ${f(dh, 2)}`,
              value: head,
              unit: 'bar',
              decimals: 2,
              note: 'Water at 1000 kg/m³.',
            }
          : {
              key: 'head',
              label: 'Static head',
              formula: 'P(head) ≈ 0',
              substitution: 'gas column, negligible',
              value: 0,
              unit: 'bar',
              decimals: 2,
            },
        {
          key: 'highPoint',
          label: 'Min test pressure at high point',
          formula: 'P(HP) = k × P(design)',
          substitution: `${v(factor)} × ${v(designPressureBarg)}`,
          value: pHigh,
          unit: 'barg',
          decimals: 2,
        },
        {
          key: 'lowPoint',
          label: 'Test pressure at low point',
          formula: 'P(LP) = P(HP) + P(head)',
          substitution: `${f(pHigh, 2)} + ${f(head, 2)}`,
          value: pLow,
          unit: 'barg',
          decimals: 2,
        },
        {
          key: 'amberFrom',
          label: `AMBER from (within ${v(amberPct)}%)`,
          formula: 'P(amber) = (1 - a) × P(max)',
          substitution: `${v(1 - amberPct / 100)} × ${v(maxAllowableTestBarg)}`,
          value: amberFrom,
          unit: 'barg',
          decimals: 2,
        },
        {
          key: 'margin',
          label: 'Margin to max allowable',
          formula: 'Margin = P(max) - P(LP)',
          substitution: `${v(maxAllowableTestBarg)} - ${f(pLow, 2)}`,
          value: margin,
          unit: 'bar',
          decimals: 2,
        },
      ],
    });

    const result = pressureFlag(pLow, maxAllowableTestBarg, amberPct);
    const lowText = `${f(pLow, 2)} barg`;
    const maxText = `${f(maxAllowableTestBarg, 2)} barg`;
    flag = {
      flag: result,
      lowPointBarg: pLow,
      maxAllowableBarg: maxAllowableTestBarg,
      amberFromBarg: amberFrom,
      marginBar: margin,
      message:
        result === 'RED'
          ? `Low point test pressure ${lowText} exceeds the max allowable ${maxText} by ${f(-margin, 2)} bar.`
          : result === 'AMBER'
            ? `Low point test pressure ${lowText} is within ${v(amberPct)}% of the max allowable ${maxText} (margin ${f(margin, 2)} bar).`
            : `Low point test pressure ${lowText} is ${f((margin / maxAllowableTestBarg) * 100, 1)}% below the max allowable ${maxText}.`,
    };
  }

  // Hold period check ----------------------------------------------------------------------
  let hold: HoldCheck | null = null;
  if (Number.isFinite(section.holdHours) && section.holdHours >= 0) {
    const min = codeRule.minHoldMinutes;
    const actual = fmtHours(section.holdHours);
    hold =
      min === null
        ? {
            actualHours: section.holdHours,
            minimumMinutes: null,
            ok: null,
            message: `${code} leaves the hold period to the client. Confirm ${actual} against the client specification.`,
          }
        : section.holdHours * 60 >= min - 1e-9
          ? {
              actualHours: section.holdHours,
              minimumMinutes: min,
              ok: true,
              message: `Hold of ${actual} meets the ${code} minimum of ${fmtMinutes(min)}.`,
            }
          : {
              actualHours: section.holdHours,
              minimumMinutes: min,
              ok: false,
              message: `Hold of ${actual} is shorter than the ${code} minimum of ${fmtMinutes(min)}.`,
            };
  }

  // Nitrogen -------------------------------------------------------------------------------
  if (values.volumeM3 !== undefined) {
    const { purgeVolumes, packingPressureBarg } = options;
    if (!isPositive(purgeVolumes)) issues.push('Nitrogen purge volumes must be greater than zero.');
    if (!Number.isFinite(packingPressureBarg) || packingPressureBarg < 0) {
      issues.push('Nitrogen packing pressure cannot be negative.');
    }
    if (isPositive(purgeVolumes) && Number.isFinite(packingPressureBarg) && packingPressureBarg >= 0) {
      const purge = purgeVolumeM3(values.volumeM3, purgeVolumes);
      const pack = packingVolumeNm3(values.volumeM3, packingPressureBarg);
      values.purgeVolumeM3 = purge;
      values.packingVolumeNm3 = pack;
      groups.push({
        key: 'nitrogen',
        title: 'Nitrogen',
        notes: [],
        steps: [
          {
            key: 'purge',
            label: 'Purge volume',
            formula: 'V(purge) = V × n',
            substitution: `${f(values.volumeM3, 2)} × ${v(purgeVolumes)}`,
            value: purge,
            unit: 'm³',
            decimals: 1,
            note: 'Approximate, at near atmospheric pressure.',
          },
          {
            key: 'packing',
            label: `Packing volume at ${v(packingPressureBarg)} barg`,
            formula: `V(pack) = V × (P(pack) + ${v(ATMOSPHERIC_BAR)}) ÷ ${v(ATMOSPHERIC_BAR)}`,
            substitution: `${f(values.volumeM3, 2)} × (${v(packingPressureBarg)} + ${v(ATMOSPHERIC_BAR)}) ÷ ${v(ATMOSPHERIC_BAR)}`,
            value: pack,
            unit: 'Nm³',
            decimals: 1,
            note: 'Approximate, ideal gas at ambient temperature.',
          },
        ],
      });
    }
  }

  return { sectionId: section.id, name: section.name, inputs, groups, values, flag, hold, issues };
}

/** Calculate every section of a job against the current rule set. */
export function calculateJob(job: Job, rules: RuleSet): JobCalc {
  const options = resolveCalcOptions(job.calcOptions, rules);
  const ctx: CalcContext = { medium: job.medium, code: job.code, rules, options };
  const sections = job.sections.map((s) => calculateSection(s, ctx));
  return { options, sections, worst: worstFlag(sections.map((s) => s.flag?.flag)) };
}

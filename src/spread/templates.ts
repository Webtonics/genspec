/**
 * The three spread templates. Each turns the job, the chosen test section and a
 * few parameters into a SpreadSpec. Numbers come from the calc engine and the
 * rule tables only: rule based, no AI.
 */
import { type JobCalc, calculateJob, fillTimeHours, usGpmToM3PerHour } from '@/calc';
import { fmtHours, fmtMinutes, fmtNumber, fmtValue } from '@/lib/format';
import type { Job, TestSection } from '@/model/types';
import type { RuleSet } from '@/rules';
import { DEFAULT_TITLE_BLOCK, documentNumber } from '@/rules/titleBlock';
import type { Attachment, SpreadNode, SpreadSpec, TemplateKey } from './types';

export type DischargeTo = 'Settling pit' | 'Water treatment unit' | 'Disposal tank';
export const DISCHARGE_OPTIONS: DischargeTo[] = ['Settling pit', 'Water treatment unit', 'Disposal tank'];

export type FloodingParams = { pumpId?: string; inhibitorDosing: boolean; pigs: boolean; recorders: boolean };
export type NitrogenParams = { source: 'pumper' | 'membrane'; rateNm3h: number; pigs: boolean; oxygenTargetPct: number };
export type DewateringParams = { compressors: number; pigs: number; discharge: DischargeTo };

export type SpreadParams = {
  template: TemplateKey;
  sectionId?: string;
  flooding: FloodingParams;
  nitrogen: NitrogenParams;
  dewatering: DewateringParams;
};

export const TEMPLATES: Record<TemplateKey, { title: string; short: string; description: string; number: number }> = {
  flooding: {
    title: 'Flooding and hydrotest spread',
    short: 'Flooding and hydrotest',
    description: 'Break tank, flooding pump, inhibitor dosing and pigs to fill; test pump, gauges, recorders and relief valve to test.',
    number: 1,
  },
  nitrogen: {
    title: 'Nitrogen purge spread',
    short: 'Nitrogen purge',
    description: 'Nitrogen unit, flow metering and relief valve to purge, oxygen analyser and vent stack at the far end.',
    number: 2,
  },
  dewatering: {
    title: 'Dewatering spread',
    short: 'Dewatering',
    description: 'Air compressors driving a pig train through the line, discharge control and metering to the disposal point.',
    number: 3,
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

export function defaultSpreadParams(job: Job): SpreadParams {
  return {
    template: job.medium === 'nitrogen' ? 'nitrogen' : 'flooding',
    sectionId: job.sections[0]?.id,
    flooding: { pumpId: job.calcOptions?.pumpId, inhibitorDosing: job.medium === 'inhibited water', pigs: true, recorders: true },
    nitrogen: { source: 'pumper', rateNm3h: 1000, pigs: false, oxygenTargetPct: 1 },
    dewatering: { compressors: 2, pigs: 2, discharge: 'Settling pit' },
  };
}

type Ctx = { job: Job; rules: RuleSet; calc: JobCalc; section?: TestSection; values: JobCalc['sections'][number]['values'] };

const instrument = (letters: string, number: string): Attachment => ({ kind: 'instrument', letters, number });
const barg = (n: number | undefined) => (n === undefined ? 'n/a' : `${fmtNumber(n, 2)} barg`);

function sectionNode(ctx: Ctx, extra: string): SpreadNode {
  const s = ctx.section;
  if (!s) return { id: 'section', kind: 'section', inside: ['NO TEST SECTION', 'Add one in Job setup'], lines: ['No section chosen'] };
  return {
    id: 'section',
    kind: 'section',
    inside: [s.name, 'PIPELINE UNDER TEST'],
    lines: [
      `${fmtValue(s.nps)}" x ${fmtNumber(s.lengthM / 1000, 2)} km`,
      ctx.values.volumeM3 !== undefined ? `Volume ${fmtNumber(ctx.values.volumeM3, 1)} m³` : 'Volume n/a',
      extra,
    ],
  };
}

function sectionNote(ctx: Ctx): string {
  const s = ctx.section;
  if (!s) return 'No test section chosen. Add test sections in Job setup.';
  return `${s.name}: ${fmtValue(s.nps)}" line, OD ${fmtValue(s.odMm)} mm x ${fmtValue(s.wtMm)} mm WT, ${fmtNumber(s.lengthM / 1000, 2)} km. Internal volume ${
    ctx.values.volumeM3 !== undefined ? `${fmtNumber(ctx.values.volumeM3, 1)} m³` : 'not calculated'
  }.`;
}

const RATED_NOTE = 'Temporary equipment, hoses and fittings to be rated for the test pressure. Figures use the rule tables: confirm with engineer.';

function flooding(ctx: Ctx, p: FloodingParams): Pick<SpreadSpec, 'main' | 'lower' | 'notes'> {
  const { rules, section, values } = ctx;
  const pump = rules.pumps.find((x) => x.id === p.pumpId) ?? ctx.calc.options.pump ?? rules.pumps[0];
  const rate = pump ? usGpmToM3PerHour(pump.ratedUsGpm) : undefined;
  const fill = values.volumeM3 !== undefined && rate ? fillTimeHours(values.volumeM3, rate) : undefined;
  const maxAllowable = section?.maxAllowableTestBarg;
  const codeRule = rules.testCodes[ctx.job.code];

  const testHead: Attachment[] = [
    instrument('PI', '02'),
    ...(p.recorders ? [instrument('PR', '01'), instrument('TR', '01')] : []),
    { kind: 'relief', tag: 'PSV-01', note: `SET ${maxAllowable !== undefined ? fmtValue(maxAllowable) : 'n/a'} barg` },
  ];
  const farEnd: Attachment[] = [instrument('PI', '03'), { kind: 'vent', tag: 'HPV-01' }];

  const main: SpreadNode[] = [
    { id: 'tank', kind: 'tank', lines: ['T-01', 'BREAK TANK', 'Filtered water'] },
    { id: 'v01', kind: 'gate', lines: ['V-01', 'SUCTION'] },
    {
      id: 'p01',
      kind: 'pump',
      lines: ['P-01', (pump?.name ?? 'Flooding pump').toUpperCase(), pump ? `${fmtValue(pump.ratedUsGpm)} US gpm` : ''],
      above: [instrument('PI', '01')],
    },
    { id: 'nrv01', kind: 'check', lines: ['NRV-01'] },
    ...(p.inhibitorDosing ? [{ id: 'p02', kind: 'injection' as const, lines: ['P-02', 'INHIBITOR', 'DOSING'] }] : []),
    { id: 'fm01', kind: 'flowmeter', lines: ['FM-01', 'FILL FLOW'], above: [instrument('FQI', '01')] },
    { id: 'v02', kind: 'ball', lines: ['V-02', 'FILL ISOLATION'], above: p.pigs ? undefined : testHead },
    ...(p.pigs
      ? [{ id: 'l01', kind: 'launcher' as const, lines: ['L-01', 'PIG LAUNCHER', 'AND TEST HEAD'], above: testHead }]
      : []),
    sectionNode(ctx, `Test ${barg(values.highPointBarg)} at HP`),
    ...(p.pigs ? [{ id: 'r01', kind: 'receiver' as const, lines: ['R-01', 'PIG RECEIVER'], above: farEnd }] : []),
    { id: 'v03', kind: 'gate', lines: ['V-03', 'DISCHARGE'], above: p.pigs ? undefined : farEnd },
    { id: 'out', kind: 'outlet', lines: ['TO PIT', 'Displaced air'], inside: ['PIT'] },
  ];

  const lower = {
    connectTo: p.pigs ? 'l01' : 'section',
    nodes: [
      { id: 'p03', kind: 'testPump' as const, lines: ['P-03', 'TEST PUMP', 'Positive displacement'], above: [instrument('PI', '04')] },
      { id: 'nrv02', kind: 'check' as const, lines: ['NRV-02'] },
      { id: 'v04', kind: 'gate' as const, lines: ['V-04', 'TEST ISOLATION'] },
    ],
  };

  const notes = [
    sectionNote(ctx),
    pump && rate
      ? `Fill with ${ctx.job.medium === 'inhibited water' ? 'inhibited water' : 'water'} using ${pump.name} P-01 (${fmtValue(pump.ratedUsGpm)} US gpm, ${fmtNumber(rate, 1)} m³/h)${
          fill !== undefined ? `: about ${fmtHours(fill)} at rated flow` : ''
        }.`
      : 'Choose a flooding pump in Settings.',
    ...(p.inhibitorDosing ? ['Dose corrosion inhibitor at P-02 in proportion to the fill flow totalised at FQI-01.'] : []),
    ...(p.pigs ? ['Fill behind a pig from L-01 to R-01 so air is swept ahead of the water and vented at HPV-01.'] : []),
    section && values.highPointBarg !== undefined && values.lowPointBarg !== undefined
      ? `Pressurise with P-03. Minimum test pressure ${barg(values.highPointBarg)} at the high point (EL ${fmtValue(section.highPointElevM)} m), ${barg(values.lowPointBarg)} at the low point (EL ${fmtValue(section.lowPointElevM)} m).`
      : 'Test pressure not calculated: complete the test section in Job setup.',
    maxAllowable !== undefined
      ? `PSV-01 set at ${barg(maxAllowable)}, the max allowable test pressure. Isolate P-03 at V-04 for the hold.`
      : 'Set PSV-01 at the max allowable test pressure.',
    section
      ? `Hold ${fmtHours(section.holdHours)} at test pressure (${ctx.job.code}${codeRule.minHoldMinutes !== null ? `, minimum ${fmtMinutes(codeRule.minHoldMinutes)}` : ''}).${
          p.recorders ? ' Record pressure and temperature on PR-01 and TR-01 throughout.' : ''
        }`
      : '',
    RATED_NOTE,
  ].filter(Boolean);

  return { main, lower, notes };
}

function nitrogen(ctx: Ctx, p: NitrogenParams): Pick<SpreadSpec, 'main' | 'lower' | 'notes'> {
  const { section, values, calc } = ctx;
  const { purgeVolumes, packingPressureBarg } = calc.options;
  const purge = values.purgeVolumeM3;
  const pack = values.packingVolumeNm3;
  const hours = purge !== undefined && p.rateNm3h > 0 ? purge / p.rateNm3h : undefined;

  const main: SpreadNode[] = [
    {
      id: 'n2',
      kind: 'n2unit',
      lines: ['N2-01', p.source === 'pumper' ? 'LIQUID N2 PUMPER' : 'MEMBRANE N2 UNIT', `${fmtValue(p.rateNm3h)} Nm³/h`],
      above: p.source === 'pumper' ? [instrument('PI', '01'), instrument('TI', '01')] : [instrument('PI', '01')],
    },
    { id: 'nrv01', kind: 'check', lines: ['NRV-01'] },
    { id: 'fm01', kind: 'flowmeter', lines: ['FM-01', 'N2 FLOW'], above: [instrument('FQI', '01')] },
    {
      id: 'v01',
      kind: 'gate',
      lines: ['V-01', 'INJECTION'],
      above: [{ kind: 'relief', tag: 'PSV-01', note: `SET ${section ? fmtValue(section.designPressureBarg) : 'n/a'} barg` }],
    },
    ...(p.pigs ? [{ id: 'l01', kind: 'launcher' as const, lines: ['L-01', 'PIG LAUNCHER'], above: [instrument('PI', '02')] }] : []),
    sectionNode(ctx, `Purge ${fmtValue(purgeVolumes)} volumes`),
    ...(p.pigs ? [{ id: 'r01', kind: 'receiver' as const, lines: ['R-01', 'PIG RECEIVER'] }] : []),
    { id: 'v02', kind: 'globe', lines: ['V-02', 'BACK PRESSURE'], above: [instrument('PI', '03'), instrument('AI', '01')] },
    { id: 'stack', kind: 'ventStack', lines: ['VS-01', 'VENT TO SAFE', 'LOCATION'] },
  ];

  const notes = [
    sectionNote(ctx),
    purge !== undefined
      ? `Purge with ${fmtValue(purgeVolumes)} line volumes, about ${fmtNumber(purge, 1)} m³ of nitrogen at near atmospheric pressure${
          hours !== undefined ? `: about ${fmtHours(hours)} at ${fmtValue(p.rateNm3h)} Nm³/h` : ''
        }.`
      : 'Purge volume not calculated: complete the test section in Job setup.',
    `Purge is complete when oxygen at AI-01 reads below ${fmtValue(p.oxygenTargetPct)}%.`,
    ...(p.pigs ? ['Run a pig from L-01 to R-01 ahead of the nitrogen to sweep out residual water.'] : []),
    pack !== undefined
      ? `Pack the line to ${fmtValue(packingPressureBarg)} barg with V-02 closed: about ${fmtNumber(pack, 1)} Nm³ of nitrogen.`
      : '',
    section ? `PSV-01 set at ${barg(section.designPressureBarg)}, the section design pressure.` : '',
    RATED_NOTE,
  ].filter(Boolean);

  return { main, notes };
}

function dewatering(ctx: Ctx, p: DewateringParams): Pick<SpreadSpec, 'main' | 'lower' | 'notes'> {
  const { values } = ctx;
  const n = Math.min(Math.max(Math.round(p.compressors), 1), 3);
  const pigs = Math.min(Math.max(Math.round(p.pigs), 1), 4);
  const tag = n === 1 ? 'C-01' : `C-01${['A', 'B', 'C'].slice(0, n).join('/')}`;
  const volume = values.volumeM3 !== undefined ? `${fmtNumber(values.volumeM3, 1)} m³` : 'the line volume';

  const main: SpreadNode[] = [
    {
      id: 'c01',
      kind: 'compressor',
      lines: [tag, n === 1 ? 'AIR COMPRESSOR' : `${n} x AIR COMPRESSORS`],
      above: [instrument('PI', '01'), instrument('TI', '01')],
    },
    { id: 'nrv01', kind: 'check', lines: ['NRV-01'] },
    { id: 'v01', kind: 'gate', lines: ['V-01', 'AIR INJECTION'] },
    {
      id: 'l01',
      kind: 'launcher',
      lines: ['L-01', 'PIG LAUNCHER', `${pigs} PIG TRAIN`],
      above: [instrument('PI', '02')],
    },
    sectionNode(ctx, `Dewatered by ${pigs} ${pigs === 1 ? 'pig' : 'pigs'}`),
    { id: 'r01', kind: 'receiver', lines: ['R-01', 'PIG RECEIVER'], above: [instrument('PI', '03')] },
    { id: 'v02', kind: 'globe', lines: ['V-02', 'DISCHARGE CONTROL'] },
    { id: 'fm01', kind: 'flowmeter', lines: ['FM-01', 'DISCHARGE FLOW'], above: [instrument('FQI', '01'), instrument('AI', '01')] },
    { id: 'out', kind: 'outlet', lines: ['TO', p.discharge.toUpperCase()], inside: ['OUT'] },
  ];

  const notes = [
    sectionNote(ctx),
    `Displace about ${volume} of test water with a ${pigs}-pig train driven by compressed air from ${tag}.`,
    `Discharge to the ${p.discharge.toLowerCase()} through V-02. Total the discharge at FQI-01 and check water quality at AI-01 before release.`,
    'Hold back pressure at V-02 so the pig train runs at a steady speed. Receive every pig at R-01 before releasing pressure.',
    RATED_NOTE,
  ];

  return { main, notes };
}

export function buildSpread(
  job: Job,
  params: SpreadParams,
  rules: RuleSet,
  documentFormat: string = DEFAULT_TITLE_BLOCK.documentFormat,
): SpreadSpec {
  const calc = calculateJob(job, rules);
  const section = job.sections.find((s) => s.id === params.sectionId) ?? job.sections[0];
  const values = calc.sections.find((s) => s.sectionId === section?.id)?.values ?? {};
  const ctx: Ctx = { job, rules, calc, section, values };
  const template = TEMPLATES[params.template];
  const body =
    params.template === 'flooding'
      ? flooding(ctx, params.flooding)
      : params.template === 'nitrogen'
        ? nitrogen(ctx, params.nitrogen)
        : dewatering(ctx, params.dewatering);

  return {
    template: params.template,
    title: template.title,
    subtitle: `${job.jobNo}  ·  ${job.title}${section ? `  ·  ${section.name}` : ''}`,
    drawingNo: documentNumber(documentFormat, job.jobNo, 'SPD', template.number),
    ...body,
  };
}

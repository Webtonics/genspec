/**
 * Strict JSON schemas for the model's answers. Strict mode means every object
 * lists all its properties as required and allows no others; optional values are
 * nullable instead. These mirror the types in src/ai/types.ts.
 */

const PRESSURE = ['barg', 'bar', 'psig', 'psi', 'kPa', 'MPa'];
const LENGTH = ['m', 'km', 'ft', 'mi'];
const SIZE = ['mm', 'in'];
const ELEVATION = ['m', 'ft'];
const DURATION = ['h', 'min'];

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };
const strings = { type: 'array', items: { type: 'string' } };
const nullableEnum = (values: string[]) => ({ type: ['string', 'null'], enum: [...values, null] });

function object(properties: Record<string, object>) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

const quantity = (units: string[]) => ({
  anyOf: [object({ value: { type: 'number' }, unit: { type: 'string', enum: units } }), { type: 'null' }],
});

export const JOB_SCHEMA = object({
  title: nullableString,
  client: nullableString,
  jobNo: nullableString,
  medium: nullableEnum(['inhibited water', 'nitrogen', 'air']),
  code: nullableEnum(['ASME B31.3', 'ASME B31.4', 'ASME B31.8', 'Client spec']),
  sections: {
    type: 'array',
    items: object({
      name: nullableString,
      nps: nullableNumber,
      od: quantity(SIZE),
      wt: quantity(SIZE),
      length: quantity(LENGTH),
      designPressure: quantity(PRESSURE),
      maxAllowableTest: quantity(PRESSURE),
      highPointElevation: quantity(ELEVATION),
      lowPointElevation: quantity(ELEVATION),
      hold: quantity(DURATION),
    }),
  },
  notes: strings,
});

const tagged = (extra: Record<string, object>) => ({ type: 'array', items: object({ tag: { type: 'string' }, ...extra }) });

export const REGISTER_SCHEMA = object({
  drawing: object({ number: nullableString, title: nullableString, revision: nullableString, client: nullableString }),
  lines: tagged({ size: nullableString, service: nullableString }),
  equipment: tagged({ kind: { type: 'string' }, description: nullableString }),
  valves: tagged({
    kind: { type: 'string', enum: ['gate', 'ball', 'globe', 'check', 'relief', 'control', 'other'] },
    normallyClosed: { type: ['boolean', 'null'] },
    description: nullableString,
  }),
  instruments: tagged({ kind: { type: 'string' }, description: nullableString }),
  designData: object({
    lineTag: nullableString,
    designCode: nullableString,
    pipeOd: quantity(SIZE),
    wallThickness: quantity(SIZE),
    length: quantity(LENGTH),
    designPressure: quantity(PRESSURE),
    highPointElevation: quantity(ELEVATION),
    lowPointElevation: quantity(ELEVATION),
  }),
  suggestions: {
    type: 'array',
    items: object({
      action: { type: 'string', enum: ['boundary', 'blind', 'vent', 'drain', 'fill', 'gauge', 'recorder', 'valve'] },
      nearTag: nullableString,
      reason: { type: 'string' },
    }),
  },
  notes: strings,
});

export const PARSE_JOB_PROMPT = `You extract pipeline pre-commissioning job data from a short description written by an engineer.

Rules:
- Return only what the text states. Never calculate, estimate or assume an engineering value. If a value is not stated, return null.
- title: a short job title of at most 60 characters built from the text, for example "GL-202 gas lift line hydrotest". Not the whole sentence.
- Report every quantity as the number and the unit exactly as written. Do not convert units: the application converts them.
- nps is the nominal pipe size in inches: "12 inch line" or 12" gives 12.
- Elevations: "high point 45 m" is highPointElevation, "low point 3 m" is lowPointElevation.
- Pressures: "design 99 barg" is designPressure. Only fill maxAllowableTest when a maximum allowable test pressure is stated.
- medium: water or hydrotest gives "inhibited water"; nitrogen or N2 gives "nitrogen"; air or pneumatic with air gives "air".
- code: map B31.3, B31.4 and B31.8 to the ASME names; a client specification gives "Client spec".
- One section per line or test section described. Give a section a name only if one is stated (for example TP-012).
- notes: only real ambiguities or conflicts, such as a pressure given without saying gauge or absolute, or two values that disagree. Do not list fields that are simply not mentioned: the application shows those. Usually zero to two notes.`;

export const READ_DRAWING_PROMPT = `You read piping and instrumentation diagrams (P&IDs) for a pipeline pre-commissioning contractor that pressure tests, floods, purges and dewaters lines.

From the drawing image, and the text found in the PDF when it is provided, list:
- drawing: number, title, revision and client from the title block.
- lines: line numbers (for example 12"-EXP-001) with size and service.
- equipment: tagged equipment such as pig launchers, receivers, pumps, vessels.
- valves: every tagged valve, its type from the symbol (use "other" only when the symbol is unclear), and normallyClosed true when the symbol is drawn solid or marked NC.
- instruments: tagged instruments (PI, PT, TT, XI and so on). Instrument bubbles print the letters above the number: report them as letters, hyphen, number, for example PI-101.
- designData: values stated in notes or callouts for the main pipeline (outside diameter, wall thickness, length, design pressure, high and low point elevations, design code, line tag). Give numbers and units exactly as written. Do not convert or calculate.
- suggestions: how to set up a hydrostatic test of the main pipeline, one item each:
  - valve: the valves to close as test limits, normally one at each end of the test section. nearTag is that valve.
  - boundary: at most one, describing in the reason which section the test boundary encloses.
  - blind: a spectacle blind or spade where the test section meets piping or equipment that must not see test pressure. Every relief valve connected to the test section gets one, with nearTag the relief valve tag. Never at insulating joints, vents, drains or closures.
  - vent at high points, drain at low points, fill at the fill connection, gauge and recorder at the test ends.
- notes: anything unreadable, uncertain or assumed, in short sentences.

Rules:
- nearTag must be text printed on the drawing, copied exactly with nothing added: a tag, a line number, or a label such as 2" VENT. Put any location detail in the reason. Use null when no printed text is near.
- Use tags exactly as printed. Never invent a tag. Leave out anything you cannot read and say so in notes.
- Never calculate test pressures or volumes. The engineer and the application do that.`;

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpreadDiagram } from '@/components/spread/SpreadDiagram';
import { makeDemoJobs } from '@/model/seed';
import { makeDefaultRules } from '@/rules';
import { DIAGRAM_PALETTES } from '@/symbols';
import { findOverlaps, layoutSpread } from './layout';
import { type SpreadParams, buildSpread, defaultSpreadParams } from './templates';
import { textWidth } from './textWidth';

const [hydro, n2] = makeDemoJobs();
const rules = makeDefaultRules();

/** Every combination of the template options. */
function variants(): { name: string; params: SpreadParams }[] {
  const base = defaultSpreadParams(hydro);
  const out: { name: string; params: SpreadParams }[] = [];
  for (const inhibitorDosing of [true, false])
    for (const pigs of [true, false])
      for (const recorders of [true, false])
        out.push({
          name: `flooding dosing=${inhibitorDosing} pigs=${pigs} recorders=${recorders}`,
          params: { ...base, template: 'flooding', flooding: { ...base.flooding, inhibitorDosing, pigs, recorders } },
        });
  for (const source of ['pumper', 'membrane'] as const)
    for (const pigs of [true, false])
      out.push({ name: `nitrogen ${source} pigs=${pigs}`, params: { ...base, template: 'nitrogen', nitrogen: { ...base.nitrogen, source, pigs } } });
  for (const compressors of [1, 2, 3])
    for (const discharge of ['Settling pit', 'Water treatment unit', 'Disposal tank'] as const)
      out.push({
        name: `dewatering compressors=${compressors} discharge=${discharge}`,
        params: { ...base, template: 'dewatering', dewatering: { compressors, pigs: 3, discharge } },
      });
  out.push({ name: 'flooding on the short TP-013 section', params: { ...base, sectionId: 'demo-sec-tp013' } });
  return out;
}

describe('text widths (Helvetica metrics)', () => {
  it('measures known strings', () => {
    expect(textWidth('MM', 10)).toBeCloseTo(16.66, 2);
    expect(textWidth('ii', 10)).toBeCloseTo(4.44, 2);
    expect(textWidth('P-01', 10, true)).toBeGreaterThan(textWidth('P-01', 10));
  });
});

describe.each(variants())('$name', ({ params }) => {
  const spec = buildSpread(hydro, params, rules);
  const layout = layoutSpread(spec);

  it('has no overlapping labels, symbols or instrument bubbles', () => {
    const overlaps = findOverlaps(layout).map(([a, b]) => `${a.owner}/${a.what} x ${b.owner}/${b.what}`);
    expect(overlaps).toEqual([]);
  });

  it('places equipment left to right in flow order', () => {
    const mainXs = layout.nodes.filter((n) => n.lane === 'main').map((n) => n.x);
    expect(mainXs).toEqual([...mainXs].sort((a, b) => a - b));
    expect(layout.nodes.filter((n) => n.lane === 'main').map((n) => n.node.id)).toEqual(spec.main.map((n) => n.id));
  });

  it('places every instrument above its own equipment, inside its column', () => {
    for (const a of layout.attachments) {
      const owner = layout.nodes.find((n) => n.node.id === a.owner)!;
      expect(a.x).toBeGreaterThan(owner.colLeft);
      expect(a.x).toBeLessThan(owner.colRight);
    }
  });

  it('keeps the drawing inside its frame', () => {
    for (const b of layout.boxes) {
      expect(b.x0).toBeGreaterThanOrEqual(layout.frame.x);
      expect(b.x1).toBeLessThanOrEqual(layout.frame.x + layout.frame.w);
      expect(b.y1).toBeLessThanOrEqual(layout.frame.y + layout.frame.h);
    }
  });
});

describe('flooding and hydrotest spread', () => {
  const spec = buildSpread(hydro, defaultSpreadParams(hydro), rules);
  const layout = layoutSpread(spec);

  it('runs tank, pump, dosing, meter, launcher, section, receiver, discharge', () => {
    expect(spec.main.map((n) => n.id)).toEqual(['tank', 'v01', 'p01', 'nrv01', 'p02', 'fm01', 'v02', 'l01', 'section', 'r01', 'v03', 'out']);
    expect(spec.drawingNo).toBe('GPPSL-26-0412-SPD-01');
  });

  it('tees the test pump into the main line at the launcher', () => {
    const launcher = layout.nodes.find((n) => n.node.id === 'l01')!;
    expect(layout.junctions).toEqual([{ x: launcher.colLeft, y: layout.mainY }]);
    expect(layout.nodes.filter((n) => n.lane === 'lower').map((n) => n.node.id)).toEqual(['p03', 'nrv02', 'v04']);
  });

  it('takes its figures from the calculations and rule tables', () => {
    const notes = spec.notes.join(' ');
    expect(notes).toContain('Internal volume 875.8 m³');
    expect(notes).toContain('3,150 US gpm, 715.4 m³/h): about 1 h 13 min');
    expect(notes).toContain('123.75 barg at the high point');
    expect(notes).toContain('PSV-01 set at 130.00 barg');
    expect(notes).toContain('Hold 4 h at test pressure (ASME B31.4, minimum 4 h)');
    const psv = spec.main.find((n) => n.id === 'l01')!.above!.find((a) => a.kind === 'relief');
    expect(psv).toMatchObject({ tag: 'PSV-01', note: 'SET 130 barg' });
  });
});

describe('nitrogen purge spread', () => {
  const spec = buildSpread(n2, defaultSpreadParams(n2), rules);

  it('is the default for a nitrogen job and ends at a vent stack with an oxygen analyser', () => {
    expect(spec.template).toBe('nitrogen');
    expect(spec.main.at(-1)?.kind).toBe('ventStack');
    expect(spec.main.find((n) => n.id === 'v02')?.above).toContainEqual({ kind: 'instrument', letters: 'AI', number: '01' });
  });

  it('works out purge time and packing volume from the job', () => {
    const notes = spec.notes.join(' ');
    expect(notes).toContain('about 629.5 m³ of nitrogen');
    expect(notes).toContain('about 38 min at 1,000 Nm³/h');
    expect(notes).toContain('about 624.1 Nm³');
    expect(notes).toContain('PSV-01 set at 85.00 barg');
  });
});

describe('rendering', () => {
  it('renders a self-contained SVG with inline colours only', () => {
    const spec = buildSpread(hydro, defaultSpreadParams(hydro), rules);
    const html = renderToStaticMarkup(
      <SpreadDiagram layout={layoutSpread(spec)} spec={spec} job={hydro} palette={DIAGRAM_PALETTES.scada} />,
    );
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).not.toContain('class=');
    expect(html).not.toContain('NaN');
    expect(html).toContain('#00E87B');
    for (const tag of ['P-01', 'P-03', 'PSV-01', 'L-01', 'TP-012', 'GPPSL-26-0412-SPD-01', 'FOR REVIEW', 'LEGEND', 'NOTES']) {
      expect(html).toContain(tag);
    }
  });
});

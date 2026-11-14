/**
 * Draws a laid-out spread diagram. Uses only inline colours from the palette (no
 * CSS classes), so the serialised SVG downloads exactly as shown.
 */
import type { Ref } from 'react';
import { fmtDate } from '@/lib/format';
import { type LegendKey, NODE_SPECS, type PlacedAttachment, type PlacedNode, type SpreadLayout } from '@/spread/layout';
import type { NodeKind, SpreadSpec } from '@/spread/types';
import type { Job } from '@/model/types';
import { DEFAULT_TITLE_BLOCK, type TitleBlockSettings } from '@/rules/titleBlock';
import { textWidth } from '@/spread/textWidth';
import {
  BallValve,
  CentrifugalPump,
  CheckValve,
  Cloud,
  Compressor,
  DIAGRAM_FONT,
  type DiagramPalette,
  FlowArrow,
  FlowMeter,
  GateValve,
  GlobeValve,
  InjectionPoint,
  InstrumentBubble,
  NitrogenUnit,
  OffPageConnector,
  PaletteProvider,
  PigLauncher,
  PigReceiver,
  PositiveDisplacementPump,
  ReliefValve,
  Tank,
  Vent,
  VentStack,
} from '@/symbols';

function NodeSymbol({ kind, x, y, inside }: { kind: NodeKind; x: number; y: number; inside?: string[] }) {
  const at = { x, y };
  switch (kind) {
    case 'tank':
      return <Tank {...at} />;
    case 'pump':
      return <CentrifugalPump {...at} />;
    case 'testPump':
      return <PositiveDisplacementPump {...at} />;
    case 'compressor':
      return <Compressor {...at} />;
    case 'n2unit':
      return <NitrogenUnit {...at} />;
    case 'gate':
      return <GateValve {...at} />;
    case 'ball':
      return <BallValve {...at} />;
    case 'globe':
      return <GlobeValve {...at} />;
    case 'check':
      return <CheckValve {...at} />;
    case 'flowmeter':
      return <FlowMeter {...at} />;
    case 'injection':
      return <InjectionPoint {...at} />;
    case 'launcher':
      return <PigLauncher {...at} />;
    case 'receiver':
      return <PigReceiver {...at} />;
    case 'outlet':
      return <OffPageConnector {...at} text={inside?.[0]} />;
    case 'ventStack':
      return <VentStack {...at} />;
    case 'section':
      return null; // drawn by SectionSymbol, which needs the palette for the line
  }
}

function SectionSymbol({ node, p }: { node: PlacedNode; p: DiagramPalette }) {
  const [x0, , x1] = NODE_SPECS.section.box;
  return (
    <g>
      <Cloud x={node.x} y={node.y} width={x1 - x0 - 16} height={78} />
      <line x1={node.x + x0} y1={node.y} x2={node.x + x1} y2={node.y} stroke={p.line} strokeWidth={4} />
      {/* break marks: the pipeline is far longer than drawn */}
      {[-14, 14].map((dx) => (
        <line key={dx} x1={node.x + dx - 5} y1={node.y + 9} x2={node.x + dx + 5} y2={node.y - 9} stroke={p.line} strokeWidth={2} />
      ))}
      <rect x={node.x - 9} y={node.y - 3} width={18} height={6} fill={p.background} />
    </g>
  );
}

function AttachmentSymbol({ a, p }: { a: PlacedAttachment; p: DiagramPalette }) {
  const att = a.attachment;
  if (att.kind === 'instrument') {
    const cy = a.lineY - 84;
    return (
      <g>
        <line x1={a.x} y1={cy + 15} x2={a.x} y2={a.tapY} stroke={p.instrument} strokeWidth={1.3} />
        <circle cx={a.x} cy={a.tapY} r={2.2} fill={p.instrument} />
        <InstrumentBubble x={a.x} y={cy} letters={att.letters} number={att.number} />
      </g>
    );
  }
  if (att.kind === 'relief') return <ReliefValve x={a.x - 6} y={a.tapY} />;
  return <Vent x={a.x} y={a.tapY} />;
}

/** A small symbol for the legend, fitted into a 44 x 22 box centred on (cx, cy). */
function LegendIcon({ k, cx, cy, p }: { k: LegendKey; cx: number; cy: number; p: DiagramPalette }) {
  if (k === 'instrument') return <InstrumentBubble x={cx} y={cy} scale={0.66} letters="PI" number="" />;
  if (k === 'relief') return <ReliefValve x={cx - 4} y={cy + 13} scale={0.55} />;
  if (k === 'vent') return <Vent x={cx} y={cy + 11} scale={0.8} />;
  if (k === 'flow') {
    return (
      <g>
        <line x1={cx - 18} y1={cy} x2={cx + 14} y2={cy} stroke={p.line} strokeWidth={2} />
        <FlowArrow x={cx + 12} y={cy} />
      </g>
    );
  }
  if (k === 'section') return <Cloud x={cx} y={cy} width={38} height={18} scale={1} />;
  const [x0, y0, x1, y1] = NODE_SPECS[k].box;
  const scale = Math.min(44 / (x1 - x0), 22 / (y1 - y0), 1);
  const ox = cx - ((x0 + x1) / 2) * scale;
  const oy = cy - ((y0 + y1) / 2) * scale;
  return (
    <g transform={`translate(${ox} ${oy}) scale(${scale})`}>
      <NodeSymbol kind={k} x={0} y={0} inside={k === 'outlet' ? [''] : undefined} />
    </g>
  );
}

function TitleBlock({
  layout,
  spec,
  job,
  p,
  company,
}: {
  layout: SpreadLayout;
  spec: SpreadSpec;
  job: Job;
  p: DiagramPalette;
  company: TitleBlockSettings;
}) {
  const { x, y, w, h } = layout.titleBlock;
  const approved = job.status === 'APPROVED';
  const status = approved
    ? `APPROVED${job.approvedBy ? ` ${job.approvedBy}` : ''}${job.approvedAt ? `, ${fmtDate(job.approvedAt)}` : ''}`
    : 'FOR REVIEW';
  const label = (lx: number, ly: number, t: string) => (
    <text x={lx} y={ly} fontSize={8} fill={p.muted} letterSpacing={0.4}>
      {t}
    </text>
  );
  const value = (lx: number, ly: number, t: string, size = 11.5, fill = p.text) => (
    <text x={lx} y={ly} fontSize={size} fontWeight={700} fill={fill}>
      {t}
    </text>
  );
  const r1 = y + 44;
  const r2 = r1 + 54;
  const r3 = r2 + 40;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={p.background} stroke={p.line} strokeWidth={1.8} />
      <line x1={x} y1={r1} x2={x + w} y2={r1} stroke={p.line} strokeWidth={1} />
      <line x1={x} y1={r2} x2={x + w} y2={r2} stroke={p.line} strokeWidth={1} />
      <line x1={x} y1={r3} x2={x + w} y2={r3} stroke={p.line} strokeWidth={1} />
      <line x1={x + w * 0.42} y1={r2} x2={x + w * 0.42} y2={y + h} stroke={p.line} strokeWidth={1} />
      <line x1={x + w * 0.78} y1={r2} x2={x + w * 0.78} y2={y + h} stroke={p.line} strokeWidth={1} />

      {value(x + 14, y + 30, company.company, 20)}
      <text x={x + 26 + textWidth(company.company, 20, true)} y={y + 22} fontSize={9.5} fill={p.muted}>
        {company.tagline}
      </text>
      <text x={x + 26 + textWidth(company.company, 20, true)} y={y + 35} fontSize={9.5} fill={p.muted}>
        Client: {job.client || 'not set'}
      </text>
      <text x={x + w - 14} y={y + 29} textAnchor="end" fontSize={11} fontWeight={700} fill={approved ? p.line : p.accent}>
        {status}
      </text>

      {label(x + 14, r1 + 14, 'TITLE')}
      {value(x + 14, r1 + 32, spec.title.toUpperCase(), 12.5)}
      <text x={x + 14} y={r1 + 46} fontSize={9.5} fill={p.muted}>
        {job.title.length > 60 ? `${job.title.slice(0, 57)}...` : job.title}
      </text>

      {label(x + 14, r2 + 14, 'DRAWING NO.')}
      {value(x + 14, r2 + 31, spec.drawingNo)}
      {label(x + w * 0.42 + 12, r2 + 14, 'JOB NO.')}
      {value(x + w * 0.42 + 12, r2 + 31, job.jobNo)}
      {label(x + w * 0.78 + 12, r2 + 14, 'REV')}
      {value(x + w * 0.78 + 12, r2 + 31, job.revision, 14)}

      {label(x + 14, r3 + 14, 'STATUS')}
      {value(x + 14, r3 + 31, approved ? 'APPROVED' : 'FOR REVIEW', 11.5, approved ? p.line : p.accent)}
      {label(x + w * 0.42 + 12, r3 + 14, 'SCALE')}
      {value(x + w * 0.42 + 12, r3 + 31, 'NTS')}
      {label(x + w * 0.78 + 12, r3 + 14, 'SHEET')}
      {value(x + w * 0.78 + 12, r3 + 31, '1 OF 1')}
    </g>
  );
}

export function SpreadDiagram({
  layout,
  spec,
  job,
  palette: p,
  company = DEFAULT_TITLE_BLOCK,
  ref,
  className,
}: {
  layout: SpreadLayout;
  spec: SpreadSpec;
  job: Job;
  palette: DiagramPalette;
  company?: TitleBlockSettings;
  ref?: Ref<SVGSVGElement>;
  className?: string;
}) {
  const { width, height } = layout;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fontFamily={DIAGRAM_FONT}
      className={className}
      role="img"
      aria-label={`${spec.title}, drawing ${spec.drawingNo}`}
      data-testid="spread-diagram"
    >
      <PaletteProvider value={p}>
        <rect width={width} height={height} fill={p.background} />
        <rect x={layout.frame.x} y={layout.frame.y} width={layout.frame.w} height={layout.frame.h} fill="none" stroke={p.line} strokeWidth={1.4} />

        {layout.pipes.map((pts, i) => (
          <polyline
            key={i}
            points={pts.map((pt) => `${pt.x},${pt.y}`).join(' ')}
            fill="none"
            stroke={p.line}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
        ))}
        {layout.junctions.map((j, i) => (
          <circle key={i} cx={j.x} cy={j.y} r={3.6} fill={p.line} />
        ))}

        {layout.nodes.map((n) =>
          n.node.kind === 'section' ? (
            <SectionSymbol key={n.node.id} node={n} p={p} />
          ) : (
            <g key={n.node.id} data-node={n.node.id}>
              <NodeSymbol kind={n.node.kind} x={n.x} y={n.y} inside={n.node.inside} />
            </g>
          ),
        )}
        {layout.attachments.map((a, i) => (
          <AttachmentSymbol key={i} a={a} p={p} />
        ))}
        {layout.arrows.map((a, i) => (
          <FlowArrow key={i} x={a.x} y={a.y} direction={a.direction} />
        ))}

        {layout.texts.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={t.y}
            textAnchor={t.anchor}
            fontSize={t.size}
            fontWeight={t.bold ? 700 : 400}
            fill={t.tone === 'accent' ? p.accent : t.tone === 'muted' ? p.muted : p.text}
          >
            {t.text}
          </text>
        ))}

        {/* Legend */}
        <g>
          <rect x={layout.legend.x} y={layout.legend.y} width={layout.legend.w} height={layout.legend.h} fill={p.background} stroke={p.line} strokeWidth={1.2} />
          <text x={layout.legend.x + 14} y={layout.legend.y + 22} fontSize={11} fontWeight={700} fill={p.text} letterSpacing={0.6}>
            LEGEND
          </text>
          {layout.legend.entries.map((e) => (
            <g key={e.key}>
              <LegendIcon k={e.key} cx={e.x + 22} cy={e.y - 4} p={p} />
              <text x={e.x + 54} y={e.y} fontSize={10.5} fill={p.text}>
                {e.label}
              </text>
            </g>
          ))}
        </g>

        {/* Notes */}
        <g>
          <rect x={layout.notes.x} y={layout.notes.y} width={layout.notes.w} height={layout.notes.h} fill={p.background} stroke={p.line} strokeWidth={1.2} />
          <text x={layout.notes.x + 14} y={layout.notes.y + 22} fontSize={11} fontWeight={700} fill={p.text} letterSpacing={0.6}>
            NOTES
          </text>
          {layout.notes.lines.map((l, i) => (
            <text key={i} x={l.x} y={l.y} fontSize={10.5} fill={p.text}>
              {l.text}
            </text>
          ))}
        </g>

        <TitleBlock layout={layout} spec={spec} job={job} p={p} company={company} />
      </PaletteProvider>
    </svg>
  );
}

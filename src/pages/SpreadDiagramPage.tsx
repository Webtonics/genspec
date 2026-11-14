import { Download, FileImage, LoaderCircle, Maximize2, Minimize2 } from 'lucide-react';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { JobPageHeader } from '@/components/JobPageHeader';
import { SpreadDiagram } from '@/components/spread/SpreadDiagram';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { Card, Page } from '@/components/ui/Page';
import { RuleStatus } from '@/components/ui/RuleStatus';
import { useCurrentJob } from '@/hooks/useCurrentJob';
import { cx } from '@/lib/cx';
import { downloadPng, downloadSvg } from '@/spread/exportImage';
import { layoutSpread } from '@/spread/layout';
import { DISCHARGE_OPTIONS, type DischargeTo, type SpreadParams, TEMPLATES, TEMPLATE_KEYS, buildSpread } from '@/spread/templates';
import { useRules, useTitleBlock } from '@/store/settingsStore';
import { resolveSpreadParams, useSpreadStore } from '@/store/spreadStore';
import { useUiStore } from '@/store/uiStore';
import { DIAGRAM_PALETTES } from '@/symbols';

const control =
  'h-8 w-full cursor-pointer rounded-md border border-line bg-surface px-2 text-sm text-ink outline-none hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm text-ink">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 cursor-pointer accent-primary" />
    </label>
  );
}

export function SpreadDiagramPage() {
  const job = useCurrentJob();
  const rules = useRules();
  const mode = useUiStore((s) => s.mode);
  const stored = useSpreadStore((s) => s.byJob[job.id]);
  const setStored = useSpreadStore((s) => s.setParams);
  const svgRef = useRef<SVGSVGElement>(null);
  const [fit, setFit] = useState(true);
  const [busy, setBusy] = useState<'svg' | 'png' | null>(null);

  const params = useMemo(() => resolveSpreadParams(job, stored), [job, stored]);
  const set = (patch: Partial<SpreadParams>) => setStored(job.id, { ...params, ...patch });

  const titleBlock = useTitleBlock();
  const spec = useMemo(() => buildSpread(job, params, rules, titleBlock.documentFormat), [job, params, rules, titleBlock]);
  const layout = useMemo(() => layoutSpread(spec), [spec]);
  const palette = DIAGRAM_PALETTES[mode];
  const fileBase = `${spec.drawingNo}_${params.template}-spread_Rev${job.revision}`;

  const save = async (kind: 'svg' | 'png') => {
    if (!svgRef.current) return;
    setBusy(kind);
    try {
      if (kind === 'svg') downloadSvg(svgRef.current, `${fileBase}.svg`);
      else await downloadPng(svgRef.current, `${fileBase}.png`);
    } finally {
      setBusy(null);
    }
  };

  const f = params.flooding;
  const n = params.nitrogen;
  const d = params.dewatering;

  return (
    <Page className="max-w-[1680px]">
      <JobPageHeader
        job={job}
        pageKey="spread"
        actions={
          <>
            <Button onClick={() => save('svg')} disabled={busy !== null}>
              {busy === 'svg' ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
              SVG
            </Button>
            <Button variant="primary" onClick={() => save('png')} disabled={busy !== null}>
              {busy === 'png' ? <LoaderCircle size={15} className="animate-spin" /> : <FileImage size={15} />}
              PNG
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 text-[11px] font-semibold tracking-wider text-muted uppercase">Template</div>
            <div className="space-y-2" role="radiogroup" aria-label="Spread template">
              {TEMPLATE_KEYS.map((key) => {
                const t = TEMPLATES[key];
                const active = params.template === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set({ template: key })}
                    className={cx(
                      'block w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors',
                      active ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-line hover:border-line-strong hover:bg-surface-2',
                    )}
                  >
                    <div className={cx('text-sm font-semibold', active ? 'text-primary' : 'text-ink')}>{t.short}</div>
                    <div className="mt-0.5 text-xs leading-snug text-muted">{t.description}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <Field label="Test section">
              <select
                className={control}
                value={params.sectionId ?? ''}
                onChange={(e) => set({ sectionId: e.target.value })}
                aria-label="Test section"
              >
                {job.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            {params.template === 'flooding' && (
              <>
                <Field label="Flooding pump">
                  <select
                    className={control}
                    value={f.pumpId ?? job.calcOptions?.pumpId ?? rules.pumps[0]?.id ?? ''}
                    onChange={(e) => set({ flooding: { ...f, pumpId: e.target.value } })}
                    aria-label="Flooding pump"
                  >
                    {rules.pumps.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="border-t border-line pt-2">
                  <Toggle label="Inhibitor dosing" checked={f.inhibitorDosing} onChange={(v) => set({ flooding: { ...f, inhibitorDosing: v } })} />
                  <Toggle label="Fill behind a pig" checked={f.pigs} onChange={(v) => set({ flooding: { ...f, pigs: v } })} />
                  <Toggle label="Pressure and temperature recorders" checked={f.recorders} onChange={(v) => set({ flooding: { ...f, recorders: v } })} />
                </div>
              </>
            )}

            {params.template === 'nitrogen' && (
              <>
                <Field label="Nitrogen source">
                  <select
                    className={control}
                    value={n.source}
                    onChange={(e) => set({ nitrogen: { ...n, source: e.target.value as typeof n.source } })}
                    aria-label="Nitrogen source"
                  >
                    <option value="pumper">Liquid nitrogen pumper</option>
                    <option value="membrane">Membrane nitrogen unit</option>
                  </select>
                </Field>
                <Field label="Nitrogen rate" hint={<RuleStatus isDefault={n.rateNm3h === 1000} defaultText="1,000 Nm³/h" />}>
                  <NumberInput
                    value={n.rateNm3h}
                    min={0}
                    exclusiveMin
                    suffix="Nm³/h"
                    className="w-full"
                    aria-label="Nitrogen rate"
                    onChange={(v) => v !== null && set({ nitrogen: { ...n, rateNm3h: v } })}
                  />
                </Field>
                <Field label="Oxygen target" hint={<RuleStatus isDefault={n.oxygenTargetPct === 1} defaultText="1%" />}>
                  <NumberInput
                    value={n.oxygenTargetPct}
                    min={0}
                    exclusiveMin
                    suffix="% O2"
                    className="w-full"
                    aria-label="Oxygen target"
                    onChange={(v) => v !== null && set({ nitrogen: { ...n, oxygenTargetPct: v } })}
                  />
                </Field>
                <div className="border-t border-line pt-2">
                  <Toggle label="Run a pig ahead of the nitrogen" checked={n.pigs} onChange={(v) => set({ nitrogen: { ...n, pigs: v } })} />
                </div>
                <p className="text-xs text-muted">Purge volumes and packing pressure come from the Calculations page.</p>
              </>
            )}

            {params.template === 'dewatering' && (
              <>
                <Field label="Air compressors">
                  <select
                    className={control}
                    value={d.compressors}
                    onChange={(e) => set({ dewatering: { ...d, compressors: Number(e.target.value) } })}
                    aria-label="Air compressors"
                  >
                    {[1, 2, 3].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pigs in the train">
                  <select
                    className={control}
                    value={d.pigs}
                    onChange={(e) => set({ dewatering: { ...d, pigs: Number(e.target.value) } })}
                    aria-label="Pigs in the train"
                  >
                    {[1, 2, 3, 4].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Discharge to">
                  <select
                    className={control}
                    value={d.discharge}
                    onChange={(e) => set({ dewatering: { ...d, discharge: e.target.value as DischargeTo } })}
                    aria-label="Discharge to"
                  >
                    {DISCHARGE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </Card>

          <p className="px-1 text-xs leading-relaxed text-muted">
            Laid out by rules: equipment left to right in flow order, instruments above their equipment, every label in its
            own column. Figures come from the job data and Settings.
          </p>
        </aside>

        <Card className="min-w-0 overflow-hidden" data-tour="spread-diagram">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{spec.title}</div>
              <div className="font-mono text-xs text-muted">
                {spec.drawingNo} · Rev {job.revision}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setFit(!fit)}>
              {fit ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              {fit ? 'Actual size' : 'Fit width'}
            </Button>
          </div>
          <div className="overflow-auto" style={{ background: palette.background }}>
            <SpreadDiagram
              ref={svgRef}
              layout={layout}
              spec={spec}
              job={job}
              palette={palette}
              company={titleBlock}
              className={fit ? 'block h-auto w-full' : 'block max-w-none'}
            />
          </div>
        </Card>
      </div>
    </Page>
  );
}

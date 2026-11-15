import { Check, ChevronDown, CircleAlert, Crosshair, LoaderCircle, MousePointerClick, RotateCw, ScanText, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useAiStore, useCachedRegister } from '@/ai/aiStore';
import { readDrawing, useAiStatus } from '@/ai/client';
import { designDataValues, locateTag, registerCount, suggestionViews } from '@/ai/drawingRegister';
import { SECTION_FIELDS, sameValue } from '@/ai/jobDraft';
import { isScannedPage, renderPageImages } from '@/ai/renderPage';
import type { DrawingRegister } from '@/ai/types';
import { cx } from '@/lib/cx';
import { fmtDate, fmtValue } from '@/lib/format';
import type { DrawingText } from '@/markup/drawingText';
import { MARKUP_TYPE_LABELS } from '@/model/options';
import type { Job, Point } from '@/model/types';
import { type PDFPageProxy, drawingKey } from '@/pdf/pdf';
import { usePdfDocument, usePdfPage } from '@/pdf/usePdf';
import { useJobStore } from '@/store/jobStore';
import { useRules } from '@/store/settingsStore';
import { AiBadge, AiErrorNotice, AiOffNotice } from '../ai/AiPieces';
import { Button, IconButton } from '../ui/Button';
import { MarkupIcon } from './MarkupGlyph';
import { useStudio } from './studioStore';

/** In-flight reads, kept outside the panel so closing it does not lose a running read. */
type Run = { phase: 'render' | 'read'; started: number } | { phase: 'error'; error: unknown };
const useRuns = create<{ runs: Record<string, Run | undefined> }>()(() => ({ runs: {} }));
const setRun = (key: string, run: Run | undefined) => useRuns.setState((s) => ({ runs: { ...s.runs, [key]: run } }));

const round1 = (n: number) => Math.round(n * 10) / 10;

async function startRead(job: Job, pageNumber: number, page: PDFPageProxy, size: { width: number; height: number }, texts: DrawingText[]) {
  if (!job.drawing) return;
  const key = `${job.id}:${pageNumber}`;
  const started = Date.now();
  setRun(key, { phase: 'render', started });
  try {
    const images = await renderPageImages(page, isScannedPage(texts));
    setRun(key, { phase: 'read', started });
    const res = await readDrawing({
      images,
      texts: texts.map((t) => ({ str: t.str, x: round1(t.x), y: round1(t.y) })),
      page: size,
      context: { medium: job.medium, code: job.code, sections: job.sections.map((s) => s.name) },
    });
    useAiStore.getState().saveRegister(job.id, {
      drawingKey: drawingKey(job.drawing),
      page: pageNumber,
      register: res.register,
      model: res.model,
      at: new Date().toISOString(),
    });
    setRun(key, undefined);
  } catch (error) {
    setRun(key, { phase: 'error', error });
  }
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{Math.max(0, Math.round((now - since) / 1000))} s</span>;
}

/** AI drawing register for the current page: tags, design data and suggested test limits. */
export function RegisterPanel({ job }: { job: Job }) {
  const status = useAiStatus();
  const pageNumber = useStudio((s) => s.pageNumber);
  const setPanel = useStudio((s) => s.setPanel);
  const { doc } = usePdfDocument(job.drawing);
  const { page, size, texts } = usePdfPage(doc, pageNumber);
  const cached = useCachedRegister(job.id, pageNumber, job.drawing ? drawingKey(job.drawing) : undefined);
  const run = useRuns((s) => s.runs[`${job.id}:${pageNumber}`]);
  const busy = run?.phase === 'render' || run?.phase === 'read';
  const canRead = Boolean(page && size && status?.enabled) && !busy;
  const read = () => page && size && startRead(job, pageNumber, page, size, texts);
  const scanned = page ? isScannedPage(texts) : false;

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-line bg-surface" aria-label="Drawing register" data-testid="register-panel">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line pr-2 pl-4">
        <ScanText size={16} className="text-ink" />
        <h2 className="text-sm font-semibold text-ink">Drawing register</h2>
        <AiBadge />
        <IconButton aria-label="Close drawing register" title="Back to properties" className="ml-auto" onClick={() => setPanel('properties')}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === null ? (
          <div className="m-4 h-24 animate-pulse rounded-lg bg-surface-2" />
        ) : !status.enabled ? (
          <AiOffNotice className="m-4" />
        ) : busy ? (
          <div className="m-4 rounded-lg border border-line bg-surface-2 px-4 py-4 text-sm" data-testid="register-busy">
            <p className="flex items-center gap-2 font-medium text-ink">
              <LoaderCircle size={16} className="animate-spin" />
              {run.phase === 'render' ? 'Preparing the page' : `Reading page ${pageNumber} with ${status.model}`}
              <span className="ml-auto text-xs font-normal text-muted">
                <Elapsed since={run.started} />
              </span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {scanned
                ? 'Scanned page: the whole sheet and four zoomed quarters are sent, so small print can be read.'
                : 'The sheet image and its text layer are sent. The PDF text gives the tags exactly.'}{' '}
              This usually takes 15 to 60 seconds. You can keep working.
            </p>
          </div>
        ) : cached ? (
          <RegisterView job={job} register={cached.register} texts={texts} pageNumber={pageNumber} />
        ) : (
          <div className="space-y-3 p-4 text-sm">
            {run?.phase === 'error' && <AiErrorNotice error={run.error} onRetry={read} />}
            <p className="leading-relaxed text-ink">
              Reads page {pageNumber} of the client drawing, scanned or not, and lists line numbers, equipment, valves, instruments and design data from the
              notes, with suggested test limits you can locate and mark up.
            </p>
            <p className="text-xs leading-relaxed text-muted">
              The page image is sent to OpenAI to be read. Check that the client agreement allows this for their drawings. Nothing is placed on the drawing or
              changed in the job until you do it.
            </p>
            <Button variant="primary" className="w-full" disabled={!canRead} onClick={read} data-testid="read-page">
              <ScanText size={15} />
              Read page {pageNumber}
            </Button>
          </div>
        )}
      </div>

      {cached && !busy && status?.enabled && (
        <div className="shrink-0 border-t border-line px-4 py-2.5 text-xs text-muted">
          {run?.phase === 'error' && (
            <div className="mb-2">
              <AiErrorNotice error={run.error} onRetry={read} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              Read by {cached.model}, {fmtDate(cached.at)}. Suggestions only: check them against the drawing.
            </span>
            <Button size="sm" variant="ghost" disabled={!canRead} onClick={read} title="Read the page again">
              <RotateCw size={13} />
              Read again
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}

function Group({ title, count, defaultOpen = true, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-2"
      >
        <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">{title}</span>
        {count !== undefined && <span className="text-[11px] font-semibold text-muted tabular-nums">{count}</span>}
        <ChevronDown size={14} className={cx('ml-auto text-muted transition-transform', open ? '' : '-rotate-90')} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </section>
  );
}

function LocateButton({ at, label, pageNumber }: { at: Point | null; label: string; pageNumber: number }) {
  const locatePoint = useStudio((s) => s.locatePoint);
  return (
    <IconButton
      aria-label={`Locate ${label}`}
      title={at ? `Show ${label} on the drawing` : 'Not found in the PDF text (scanned page or misread tag)'}
      disabled={!at}
      onClick={() => at && locatePoint(at, pageNumber, label)}
    >
      <Crosshair size={15} />
    </IconButton>
  );
}

function TagRows({ items, texts, pageNumber }: { items: { tag: string; kind?: string; detail?: string | null; chip?: string }[]; texts: DrawingText[]; pageNumber: number }) {
  if (!items.length) return <p className="px-4 text-xs text-muted">None read on this page.</p>;
  return (
    <ul>
      {items.map((item, i) => (
        <li key={`${item.tag}-${i}`} className="flex items-center gap-2 py-1 pr-2 pl-4 hover:bg-surface-2" data-tag={item.tag}>
          <span className="font-mono text-xs font-semibold text-ink">{item.tag}</span>
          {item.chip && (
            <span className="rounded bg-ink px-1 py-px text-[9px] font-bold tracking-wide text-surface uppercase" title="Normally closed">
              {item.chip}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-muted" title={[item.kind, item.detail].filter(Boolean).join(': ')}>
            {[item.kind, item.detail].filter(Boolean).join(': ')}
          </span>
          <LocateButton at={locateTag(item.tag, texts)} label={item.tag} pageNumber={pageNumber} />
        </li>
      ))}
    </ul>
  );
}

function RegisterView({ job, register, texts, pageNumber }: { job: Job; register: DrawingRegister; texts: DrawingText[]; pageNumber: number }) {
  const setTool = useStudio((s) => s.setTool);
  const locatePoint = useStudio((s) => s.locatePoint);
  const suggestions = useMemo(() => suggestionViews(register, texts, job.markups, pageNumber), [register, texts, job.markups, pageNumber]);
  const done = suggestions.filter((s) => s.done).length;
  const d = register.drawing;

  return (
    <div data-testid="register-view">
      {(d.number || d.title) && (
        <div className="border-b border-line px-4 py-3">
          <div className="font-mono text-sm font-semibold text-ink">
            {d.number ?? 'Drawing'}
            {d.revision && <span className="ml-2 text-xs font-normal text-muted">Rev {d.revision}</span>}
          </div>
          {d.title && <div className="mt-0.5 text-xs text-muted">{d.title}</div>}
          {d.client && <div className="text-xs text-muted">{d.client}</div>}
          <div className="mt-1.5 text-xs text-muted">{registerCount(register)} tagged items read</div>
        </div>
      )}

      <Group title="Suggested test limits" count={suggestions.length}>
        {suggestions.length === 0 ? (
          <p className="px-4 text-xs text-muted">No suggestions for this page.</p>
        ) : (
          <>
            <p className="px-4 pb-2 text-xs text-muted">
              {done} of {suggestions.length} marked up. Place picks the tool and shows the spot; you click where the symbol goes.
            </p>
            <ul data-testid="suggestions">
              {suggestions.map((s, i) => (
                <li key={i} className={cx('flex gap-2.5 py-2 pr-2 pl-4', s.done && 'opacity-60')} data-suggestion={s.type}>
                  <span className="grid size-7 shrink-0 place-items-center rounded bg-sheet ring-1 ring-line">
                    <MarkupIcon type={s.type} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-ink">
                      {MARKUP_TYPE_LABELS[s.type]}
                      {s.nearTag && <span className="font-mono font-normal text-muted"> at {s.nearTag}</span>}
                    </div>
                    <div className="mt-0.5 text-xs leading-snug text-muted">{s.reason}</div>
                  </div>
                  {s.done ? (
                    <span className="mt-0.5 flex h-7 shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700 scada:text-[#00E87B]">
                      <Check size={13} />
                      Done
                    </span>
                  ) : (
                    <div className="flex shrink-0 items-start">
                      <LocateButton at={s.at} label={s.nearTag ?? MARKUP_TYPE_LABELS[s.type]} pageNumber={pageNumber} />
                      <IconButton
                        aria-label={`Place ${MARKUP_TYPE_LABELS[s.type]}${s.nearTag ? ` at ${s.nearTag}` : ''}`}
                        title="Pick the tool and show the spot"
                        onClick={() => {
                          setTool(s.type);
                          if (s.at) locatePoint(s.at, pageNumber, s.nearTag ?? MARKUP_TYPE_LABELS[s.type]);
                        }}
                      >
                        <MousePointerClick size={15} />
                      </IconButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Group>

      <DesignData job={job} register={register} />

      <Group title="Valves" count={register.valves.length}>
        <TagRows
          texts={texts}
          pageNumber={pageNumber}
          items={register.valves.map((v) => ({ tag: v.tag, kind: v.kind, detail: v.description, chip: v.normallyClosed ? 'NC' : undefined }))}
        />
      </Group>
      <Group title="Equipment" count={register.equipment.length} defaultOpen={false}>
        <TagRows texts={texts} pageNumber={pageNumber} items={register.equipment.map((e) => ({ tag: e.tag, kind: e.kind, detail: e.description }))} />
      </Group>
      <Group title="Instruments" count={register.instruments.length} defaultOpen={false}>
        <TagRows texts={texts} pageNumber={pageNumber} items={register.instruments.map((e) => ({ tag: e.tag, kind: e.kind, detail: e.description }))} />
      </Group>
      <Group title="Line numbers" count={register.lines.length} defaultOpen={false}>
        <TagRows
          texts={texts}
          pageNumber={pageNumber}
          items={register.lines.map((l) => ({ tag: l.tag, kind: [l.size, l.service].filter(Boolean).join(' ') || undefined }))}
        />
      </Group>

      {register.notes.length > 0 && (
        <Group title="Notes from the AI" count={register.notes.length} defaultOpen={false}>
          <ul className="list-disc space-y-1 pr-4 pl-8 text-xs text-ink">
            {register.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Group>
      )}
    </div>
  );
}

/** Design data from the drawing notes, compared with a test section and applied on request. */
function DesignData({ job, register }: { job: Job; register: DrawingRegister }) {
  const rules = useRules();
  const updateSection = useJobStore((s) => s.updateSection);
  const [sectionId, setSectionId] = useState(job.sections[0]?.id ?? '');
  const [applied, setApplied] = useState<string | null>(null);
  const { values, notes } = useMemo(() => designDataValues(register, job.code, rules), [register, job.code, rules]);
  const section = job.sections.find((s) => s.id === sectionId) ?? job.sections[0];
  const rows = SECTION_FIELDS.flatMap((f) => (values[f.key] ? [{ ...f, proposal: values[f.key]! }] : []));
  const differences = section ? rows.filter((r) => !sameValue(section[r.key], r.proposal.value)) : [];
  const code = register.designData.designCode;

  if (!rows.length && !code) return null;

  return (
    <Group title="Design data from the notes" count={rows.length}>
      <div className="space-y-2 px-4" data-testid="design-data">
        {section && (
          <label className="flex items-center gap-2 text-xs text-muted">
            Compare with
            <select
              value={section.id}
              onChange={(e) => {
                setSectionId(e.target.value);
                setApplied(null);
              }}
              aria-label="Section to compare"
              className="h-7 cursor-pointer rounded-md border border-line bg-surface px-1.5 font-mono text-xs text-ink"
            >
              {job.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <table className="w-full text-xs">
          <tbody>
            {code && (
              <tr className="border-b border-line">
                <td className="py-1.5 pr-2 text-muted">Design code</td>
                <td className="py-1.5 font-mono text-ink">{code}</td>
                <td className="py-1.5 text-right">{code.replace(/\s/g, '').includes(job.code.replace(/\s/g, '')) ? <Match /> : <Differs text={`Job: ${job.code}`} />}</td>
              </tr>
            )}
            {rows.map((r) => {
              const same = section ? sameValue(section[r.key], r.proposal.value) : false;
              return (
                <tr key={r.key} className="border-b border-line last:border-0" data-field={r.key}>
                  <td className="py-1.5 pr-2 text-muted">{r.label}</td>
                  <td className="py-1.5 font-mono text-ink" title={r.proposal.working ?? `As written: ${r.proposal.source}`}>
                    {fmtValue(r.proposal.value)} {r.unit}
                    {r.proposal.working && <span className="block font-sans text-[10px] text-muted">{r.proposal.source}</span>}
                  </td>
                  <td className="py-1.5 text-right">
                    {section && (same ? <Match /> : <Differs text={`${section.name}: ${fmtValue(section[r.key])}`} />)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {notes.map((n) => (
          <p key={n} className="flex gap-1.5 text-xs text-amber-800 scada:text-[#FFB020]">
            <CircleAlert size={13} className="mt-0.5 shrink-0" />
            {n}
          </p>
        ))}
        {section &&
          (applied ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 scada:text-[#00E87B]">
              <Check size={13} />
              {applied}
            </p>
          ) : differences.length === 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 scada:text-[#00E87B]" data-testid="design-data-match">
              <Check size={13} />
              {section.name} agrees with the drawing notes.
            </p>
          ) : (
            <Button
              size="sm"
              className="w-full"
              data-testid="apply-design-data"
              onClick={() => {
                const patch = Object.fromEntries(differences.map((r) => [r.key, r.proposal.value]));
                updateSection(job.id, section.id, patch);
                setApplied(`Updated ${differences.length} ${differences.length === 1 ? 'value' : 'values'} on ${section.name}. Calculations have rerun.`);
              }}
            >
              Use {differences.length} drawing {differences.length === 1 ? 'value' : 'values'} for {section.name}
            </Button>
          ))}
      </div>
    </Group>
  );
}

function Match() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 scada:text-[#00E87B]">
      <Check size={12} />
      Match
    </span>
  );
}

function Differs({ text }: { text: string }) {
  return <span className="text-[11px] font-medium whitespace-nowrap text-amber-800 scada:text-[#FFB020]">{text}</span>;
}

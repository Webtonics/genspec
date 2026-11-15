import { LoaderCircle, Shapes, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { bounds } from '@/markup/geometry';
import { cx } from '@/lib/cx';
import type { Job, MarkupType } from '@/model/types';
import { usePdfDocument, usePdfPage } from '@/pdf/usePdf';
import { MarkupIcon } from './MarkupGlyph';
import { MarkupOverlay } from './MarkupOverlay';
import { PdfCanvas, ScadaPdfFilter } from './PdfCanvas';
import { useStudio } from './studioStore';
import { TOOLS, toolDef } from './tools';

/** Space around the page inside the scroll area, px. */
const PAD = 40;

/** Scroll area with the page centred, zoom anchored to the cursor, fit on load. */
export function DrawingViewer({ job }: { job: Job }) {
  const { doc, error } = usePdfDocument(job.drawing);
  const pageNumber = useStudio((s) => s.pageNumber);
  const { page, size, texts } = usePdfPage(doc, pageNumber);
  const zoom = useStudio((s) => s.zoom);
  const fitNonce = useStudio((s) => s.fitNonce);
  const focus = useStudio((s) => s.focus);
  const locate = useStudio((s) => s.locate);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScroll = useRef({ left: 0, top: 0 });
  const prevZoom = useRef(zoom);
  const fittedFor = useRef(-1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [renderedPage, setRenderedPage] = useState<number | null>(null);

  // Track the visible area.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewport({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl or pinch and scroll zooms around the pointer.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      useStudio.getState().zoomBy(Math.exp(-e.deltaY * 0.002), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const pageW = (size?.width ?? 0) * zoom;
  const pageH = (size?.height ?? 0) * zoom;
  const contentW = Math.max(viewport.width, pageW + 2 * PAD);
  const contentH = Math.max(viewport.height, pageH + 2 * PAD);
  const offsetAt = (z: number) => ({
    x: (Math.max(viewport.width, (size?.width ?? 0) * z + 2 * PAD) - (size?.width ?? 0) * z) / 2,
    y: (Math.max(viewport.height, (size?.height ?? 0) * z + 2 * PAD) - (size?.height ?? 0) * z) / 2,
  });

  // Fit the whole page when the drawing loads or when asked.
  useLayoutEffect(() => {
    if (!size || viewport.width === 0 || fittedFor.current === fitNonce) return;
    fittedFor.current = fitNonce;
    const z = Math.min((viewport.width - 2 * PAD) / size.width, (viewport.height - 2 * PAD) / size.height);
    useStudio.getState().zoomTo(z);
  }, [size, viewport.width, viewport.height, fitNonce]);

  // Keep the point under the anchor (pointer, or the centre) fixed while zooming.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const prev = prevZoom.current;
    prevZoom.current = zoom;
    if (!el || !size || prev === zoom) return;
    const anchor = useStudio.getState().zoomAnchor ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    const before = offsetAt(prev);
    const after = offsetAt(zoom);
    const pageX = (lastScroll.current.left + anchor.x - before.x) / prev;
    const pageY = (lastScroll.current.top + anchor.y - before.y) / prev;
    el.scrollLeft = pageX * zoom + after.x - anchor.x;
    el.scrollTop = pageY * zoom + after.y - anchor.y;
    lastScroll.current = { left: el.scrollLeft, top: el.scrollTop };
    // offsetAt only depends on size and viewport, read at the same render.
  }, [zoom]);

  // Scroll a markup chosen from the list into view.
  useEffect(() => {
    const el = scrollRef.current;
    const m = focus && job.markups.find((x) => x.id === focus.id);
    if (!el || !m || !size || m.page !== pageNumber) return;
    const b = bounds(m.points);
    const off = offsetAt(zoom);
    el.scrollTo({
      left: off.x + ((b.minX + b.maxX) / 2) * zoom - el.clientWidth / 2,
      top: off.y + ((b.minY + b.maxY) / 2) * zoom - el.clientHeight / 2,
      behavior: 'smooth',
    });
  }, [focus, size, pageNumber]);

  // Scroll to a spot asked for by the drawing register (Locate).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !locate || !size || locate.page !== pageNumber) return;
    const off = offsetAt(zoom);
    el.scrollTo({
      left: off.x + locate.point.x * zoom - el.clientWidth / 2,
      top: off.y + locate.point.y * zoom - el.clientHeight / 2,
      behavior: 'smooth',
    });
  }, [locate, size, pageNumber]);

  const offset = offsetAt(zoom);
  const ready = renderedPage === pageNumber;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 bg-viewer" data-tour="drawing">
        <div
          ref={scrollRef}
          data-testid="drawing-scroll"
          className="absolute inset-0 overflow-auto bg-[radial-gradient(rgb(0_0_0/0.07)_1px,transparent_1px)] bg-size-[18px_18px] scada:bg-[radial-gradient(rgb(0_232_123/0.06)_1px,transparent_1px)]"
          onScroll={(e) => {
            lastScroll.current = { left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop };
          }}
        >
          {page && size && (
            <div className="relative" style={{ width: contentW, height: contentH }}>
              <div
                data-testid="pdf-page"
                data-ready={ready ? 'true' : 'false'}
                className="absolute bg-sheet shadow-[0_10px_40px_rgb(0_0_0/0.22)] ring-1 ring-black/10"
                style={{ left: offset.x, top: offset.y, width: pageW, height: pageH }}
              >
                <PdfCanvas key={pageNumber} page={page} zoom={zoom} onRendered={() => setRenderedPage(pageNumber)} />
                <MarkupOverlay job={job} size={size} texts={texts} scrollRef={scrollRef} />
                {locate && locate.page === pageNumber && (
                  <LocatePulse key={locate.nonce} x={locate.point.x * zoom} y={locate.point.y * zoom} label={locate.label} />
                )}
              </div>
            </div>
          )}
        </div>

        {(!page || !ready) && !error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2.5 text-sm text-muted shadow-lg ring-1 ring-line">
              <LoaderCircle size={16} className="animate-spin" />
              Rendering drawing
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-8">
            <div className="max-w-md rounded-xl bg-surface p-6 text-center shadow-lg ring-1 ring-line">
              <h2 className="text-sm font-semibold text-ink">The drawing could not be opened</h2>
              <p className="mt-1 text-sm text-muted">{error}</p>
            </div>
          </div>
        )}

        <MarkupLegend job={job} />
        <ScadaPdfFilter />
      </div>
      <StatusBar />
    </div>
  );
}

/** Pulsing ring on a located tag, gone after a few seconds. */
function LocatePulse({ x, y, label }: { x: number; y: number; label: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute z-20" style={{ left: x, top: y }} data-testid="locate-pulse" aria-hidden>
      <span className="absolute -top-8 -left-8 size-16 animate-ping rounded-full border-4 border-primary/70" />
      <span className="absolute -top-8 -left-8 size-16 rounded-full border-2 border-primary bg-primary/5" />
      <span className="absolute -top-3 left-10 rounded bg-primary px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-primary-fg shadow-md">
        {label}
      </span>
    </div>
  );
}

const LEGEND_LABELS: Record<MarkupType, string> = {
  boundary: 'Boundary',
  purgeRoute: 'Purge route',
  blind: 'Blind',
  vent: 'Vent',
  drain: 'Drain',
  fill: 'Fill point',
  valve: 'Valve',
  joint: 'Joint',
  gauge: 'Gauge',
  recorder: 'Recorder',
};

const LEGEND_TYPES = TOOLS.map((t) => t.tool).filter((t): t is MarkupType => t !== 'select' && t !== 'pan');

/** Small floating key to the markup symbols, with counts for this job. */
function MarkupLegend({ job }: { job: Job }) {
  const show = useStudio((s) => s.showLegend);
  const toggle = useStudio((s) => s.toggleLegend);
  const counts = new Map<MarkupType, number>();
  for (const m of job.markups) counts.set(m.type, (counts.get(m.type) ?? 0) + 1);

  if (!show) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="absolute bottom-3 left-3 z-10 flex cursor-pointer items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-md ring-1 ring-line hover:bg-surface-2"
      >
        <Shapes size={14} />
        Legend
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 z-10 w-60 rounded-lg bg-surface/95 shadow-lg ring-1 ring-line backdrop-blur">
      <div className="flex items-center justify-between border-b border-line py-1.5 pr-1.5 pl-3">
        <span className="text-xs font-semibold text-ink">Legend</span>
        <button
          type="button"
          onClick={toggle}
          aria-label="Hide legend"
          className="grid size-6 cursor-pointer place-items-center rounded text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 p-2.5">
        {LEGEND_TYPES.map((type) => {
          const n = counts.get(type) ?? 0;
          return (
            <li key={type} className={cx('flex items-center gap-1.5 text-[11px]', n ? 'text-ink' : 'text-muted')}>
              <span className="grid size-6 shrink-0 place-items-center rounded bg-sheet ring-1 ring-line">
                <MarkupIcon type={type} className="size-5" />
              </span>
              <span className="truncate">{LEGEND_LABELS[type]}</span>
              <span className="ml-auto font-semibold tabular-nums">{n || ''}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** What the current tool does, pointer position in points, and zoom. */
function StatusBar() {
  const tool = useStudio((s) => s.tool);
  const cursor = useStudio((s) => s.cursor);
  const zoom = useStudio((s) => s.zoom);
  const draftLength = useStudio((s) => s.draft.length);
  const spaceHeld = useStudio((s) => s.spaceHeld);

  const hint = spaceHeld
    ? 'Release Space to go back to the tool.'
    : draftLength
      ? `${draftLength} ${draftLength === 1 ? 'point' : 'points'} placed. Keep clicking, then double-click or Enter to finish. Esc cancels.`
      : toolDef(tool).hint;

  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-line bg-surface px-4 text-xs text-muted">
      <span className="truncate">
        <span className="font-semibold text-ink">{toolDef(tool).label}:</span> {hint}
      </span>
      <span className="shrink-0 whitespace-nowrap font-mono tabular-nums">
        {cursor ? `x ${cursor.x.toFixed(1)}  y ${cursor.y.toFixed(1)} pt  ·  ` : ''}
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}

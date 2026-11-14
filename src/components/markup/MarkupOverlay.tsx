/**
 * SVG overlay on the PDF page. Its viewBox is the page size in PDF points, so
 * markups are stored and drawn in points and stay put at any zoom.
 */
import { type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, useRef, useState } from 'react';
import type { DrawingText } from '@/markup/drawingText';
import { clampPoint, cloudPath, polylinePath } from '@/markup/geometry';
import { type SymbolType, isPolylineType, shiftPoints, moveVertex, toggleValvePosition, translateMarkup, updateMarkup } from '@/markup/ops';
import { revisionCloudCorners } from '@/markup/symbols';
import { previewTag } from '@/markup/tags';
import { currentRevisionComments } from '@/model/revision';
import type { Job, Markup, Point } from '@/model/types';
import type { PageSize } from '@/pdf/usePdf';
import { useMarkupHistory } from '@/store/markupHistoryStore';
import { drawingTagForValve, finishDraft, placeSymbol } from './actions';
import { MarkupGlyph, PurgeRouteGlyph, SYMBOL_BOX, SymbolGlyph } from './MarkupGlyph';
import { useStudio } from './studioStore';

type Drag = { kind: 'move' | 'vertex'; id: string; index: number; origin: Point; delta: Point; moved: boolean };
type Pan = { x: number; y: number; left: number; top: number };

/** Symbol box after rotation, in absolute page points. */
function absoluteBox(m: Markup, pad: number) {
  const [x, y, w, h] = SYMBOL_BOX[m.type as SymbolType];
  const p = m.points[0];
  const r = (m.rotation ?? 0) % 180 !== 0;
  const [bx, by, bw, bh] = r ? [-(y + h), x, h, w] : [x, y, w, h];
  return { x: p.x + bx - pad, y: p.y + by - pad, width: bw + 2 * pad, height: bh + 2 * pad };
}

export function MarkupOverlay({
  job,
  size,
  texts,
  scrollRef,
}: {
  job: Job;
  size: PageSize;
  texts: DrawingText[];
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tool = useStudio((s) => s.tool);
  const selectedId = useStudio((s) => s.selectedId);
  const hoverId = useStudio((s) => s.hoverId);
  const zoom = useStudio((s) => s.zoom);
  const draft = useStudio((s) => s.draft);
  const cursor = useStudio((s) => s.cursor);
  const spaceHeld = useStudio((s) => s.spaceHeld);
  const pageNumber = useStudio((s) => s.pageNumber);
  const commit = useMarkupHistory((s) => s.commit);

  const [drag, setDrag] = useState<Drag | null>(null);
  const [panning, setPanning] = useState(false);
  const panRef = useRef<Pan | null>(null);

  const px = 1 / zoom; // one screen pixel, in points
  const panMode = tool === 'pan' || spaceHeld;
  const placingSymbol = !panMode && tool !== 'select' && !isPolylineType(tool);
  const drawingLine = !panMode && isPolylineType(tool);
  const sectionNames = new Map(job.sections.map((s) => [s.id, s.name]));
  const pageMarkups = job.markups.filter((m) => m.page === pageNumber);

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return clampPoint({ x: p.x, y: p.y }, size.width, size.height);
  };

  const isInteractive = (m: Markup) => !panMode && (tool === 'select' || (tool === 'valve' && m.type === 'valve'));

  // Drag preview: the markup as it will be when the pointer is released.
  const withDrag = (m: Markup): Markup => {
    if (!drag?.moved || drag.id !== m.id) return m;
    if (drag.kind === 'move') return { ...m, points: shiftPoints(m.points, drag.delta, size) };
    return {
      ...m,
      points: m.points.map((p, i) =>
        i === drag.index ? clampPoint({ x: p.x + drag.delta.x, y: p.y + drag.delta.y }, size.width, size.height) : p,
      ),
    };
  };

  // ---------------------------------------------------------------- pointer handling

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const studio = useStudio.getState();
    if (e.button === 1 || (e.button === 0 && panMode)) {
      const el = scrollRef.current;
      if (!el) return;
      e.preventDefault();
      panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      setPanning(true);
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = toPoint(e);
    if (tool === 'select') studio.select(null);
    else if (isPolylineType(tool)) studio.setDraft([...studio.draft, p]);
    else if (tool !== 'pan') placeSymbol(job.id, tool, p, texts);
  };

  const onMarkupPointerDown = (e: ReactPointerEvent, m: Markup) => {
    if (e.button !== 0 || !isInteractive(m)) return;
    e.stopPropagation();
    const studio = useStudio.getState();
    if (tool === 'valve') {
      commit(job.id, updateMarkup(job.markups, m.id, { valvePosition: toggleValvePosition(m.valvePosition) }));
      studio.select(m.id);
      return;
    }
    studio.select(m.id);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ kind: 'move', id: m.id, index: -1, origin: toPoint(e), delta: { x: 0, y: 0 }, moved: false });
  };

  const onVertexPointerDown = (e: ReactPointerEvent, m: Markup, index: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ kind: 'vertex', id: m.id, index, origin: m.points[index], delta: { x: 0, y: 0 }, moved: false });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (pan && scrollRef.current) {
      scrollRef.current.scrollLeft = pan.left - (e.clientX - pan.x);
      scrollRef.current.scrollTop = pan.top - (e.clientY - pan.y);
      return;
    }
    const p = toPoint(e);
    useStudio.getState().setCursor(p);
    if (drag) {
      const delta = { x: p.x - drag.origin.x, y: p.y - drag.origin.y };
      setDrag({ ...drag, delta, moved: drag.moved || Math.hypot(delta.x, delta.y) > 3 * px });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    if (panRef.current) {
      panRef.current = null;
      setPanning(false);
      return;
    }
    if (!drag) return;
    if (drag.moved) {
      const m = job.markups.find((x) => x.id === drag.id);
      if (m) {
        const next =
          drag.kind === 'move'
            ? translateMarkup(job.markups, m.id, drag.delta, size)
            : moveVertex(
                job.markups,
                m.id,
                drag.index,
                clampPoint({ x: drag.origin.x + drag.delta.x, y: drag.origin.y + drag.delta.y }, size.width, size.height),
              );
        commit(job.id, next);
      }
    }
    setDrag(null);
  };

  const onDoubleClick = () => {
    if (drawingLine && useStudio.getState().draft.length) finishDraft(job.id);
  };

  // ---------------------------------------------------------------- rendering

  const cursorStyle = panning ? 'grabbing' : panMode ? 'grab' : placingSymbol || drawingLine ? 'crosshair' : 'default';
  const lines = pageMarkups.filter((m) => isPolylineType(m.type));
  const symbols = pageMarkups.filter((m) => !isPolylineType(m.type));

  const renderMarkup = (raw: Markup) => {
    const m = withDrag(raw);
    const interactive = isInteractive(m);
    const selected = m.id === selectedId;
    const hovered = interactive && m.id === hoverId && !drag;
    const isLine = isPolylineType(m.type);
    const closed = m.type === 'boundary' && m.points.length >= 3;
    const outline = isLine ? polylinePath(m.points, closed) : '';
    const box = isLine ? null : absoluteBox(m, 3);

    return (
      <g
        key={m.id}
        data-markup-id={m.id}
        data-type={m.type}
        data-tag={m.tag}
        className={interactive ? (tool === 'valve' ? 'cursor-pointer' : 'cursor-move') : undefined}
        pointerEvents={interactive ? undefined : 'none'}
        onPointerDown={(e) => onMarkupPointerDown(e, raw)}
        onPointerEnter={() => interactive && useStudio.getState().setHover(m.id)}
        onPointerLeave={() => useStudio.getState().hoverId === m.id && useStudio.getState().setHover(null)}
      >
        {/* Hover and selection, under the markup */}
        {box && (hovered || selected) && (
          <rect
            {...box}
            rx={3}
            className="fill-selection stroke-selection"
            fillOpacity={selected ? 0.1 : 0.14}
            strokeOpacity={selected ? 1 : 0}
            strokeWidth={1.3 * px}
            strokeDasharray={`${4 * px} ${3 * px}`}
          />
        )}
        {isLine && (hovered || selected) && (
          <path
            d={outline}
            fill="none"
            className="stroke-selection"
            strokeOpacity={selected ? 0.55 : 0.35}
            strokeWidth={(selected ? 3 : 6) * px + (selected ? 0 : 2)}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        <g pointerEvents="none">
          <MarkupGlyph markup={m} sectionName={m.sectionId ? sectionNames.get(m.sectionId) : undefined} />
        </g>

        {/* Hit areas, only while the markup can be clicked */}
        {interactive && box && <rect {...box} fill="transparent" />}
        {interactive && isLine && (
          <path d={outline} fill="none" stroke="transparent" strokeWidth={Math.max(12 * px, 4)} pointerEvents="stroke" />
        )}

        {/* Vertex handles for reshaping a selected line */}
        {isLine &&
          selected &&
          tool === 'select' &&
          m.points.map((p, i) => (
            <rect
              key={i}
              data-vertex={i}
              x={p.x - 4 * px}
              y={p.y - 4 * px}
              width={8 * px}
              height={8 * px}
              className="fill-sheet stroke-selection"
              strokeWidth={1.5 * px}
              style={{ cursor: 'crosshair' }}
              onPointerDown={(e) => onVertexPointerDown(e, raw, i)}
            />
          ))}
      </g>
    );
  };

  // Ghost of the symbol about to be placed, with the tag it will get.
  let ghost: ReactNode = null;
  if (placingSymbol && cursor && !drag) {
    const type = tool as SymbolType;
    const tag = (type === 'valve' && drawingTagForValve(job, cursor, texts)) || previewTag(job.markups, type);
    ghost = (
      <g opacity={0.5} pointerEvents="none">
        <SymbolGlyph type={type} tag={tag} valvePosition="closed" point={cursor} />
      </g>
    );
  }

  // Boundary or purge route being drawn, following the pointer.
  let draftLayer: ReactNode = null;
  if (isPolylineType(tool) && draft.length > 0) {
    const pts = cursor && !panMode ? [...draft, cursor] : draft;
    draftLayer = (
      <g pointerEvents="none">
        {tool === 'boundary' ? (
          <>
            <path d={cloudPath(pts, false)} fill="none" className="stroke-markup" strokeWidth={1.8} opacity={0.85} />
            {pts.length >= 3 && cursor && (
              <line
                x1={pts[pts.length - 1].x}
                y1={pts[pts.length - 1].y}
                x2={draft[0].x}
                y2={draft[0].y}
                className="stroke-markup"
                strokeWidth={1}
                strokeDasharray={`${4 * px} ${4 * px}`}
                opacity={0.5}
              />
            )}
          </>
        ) : (
          <g opacity={0.85}>
            <PurgeRouteGlyph points={pts} />
          </g>
        )}
        {draft.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3 * px + 0.6} className="fill-sheet stroke-markup" strokeWidth={1.4 * px + 0.3} />
        ))}
      </g>
    );
  }

  return (
    <svg
      ref={svgRef}
      data-testid="markup-overlay"
      viewBox={`0 0 ${size.width} ${size.height}`}
      className="absolute inset-0 h-full w-full touch-none select-none"
      style={{ cursor: cursorStyle }}
      fontFamily="inherit"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => !drag && !panRef.current && useStudio.getState().setCursor(null)}
      onDoubleClick={onDoubleClick}
      onMouseDown={(e) => e.button === 1 && e.preventDefault()}
    >
      <rect width={size.width} height={size.height} fill="transparent" />
      {lines.map(renderMarkup)}
      {symbols.map(renderMarkup)}
      {currentRevisionComments(job).map((c) => {
        const m = pageMarkups.find((x) => x.id === c.markupId);
        if (!m) return null;
        const pts = revisionCloudCorners(withDrag(m));
        const tx = pts[1].x + 4;
        const ty = pts[1].y - 4;
        return (
          <g key={`${c.rev}-${c.at}`} pointerEvents="none" data-revision-cloud={c.rev}>
            <title>{`Rev ${c.rev} client comment: ${c.text}`}</title>
            <path d={cloudPath(pts, true, 9)} fill="none" className="stroke-markup" strokeWidth={1.4} />
            <polygon points={`${tx},${ty - 8.1} ${tx + 7},${ty + 4} ${tx - 7},${ty + 4}`} className="fill-sheet stroke-markup" strokeWidth={1.3} />
            <text x={tx} y={ty + 2.6} textAnchor="middle" fontSize={7} fontWeight={700} className="fill-markup">
              {c.rev}
            </text>
          </g>
        );
      })}
      {draftLayer}
      {ghost}
    </svg>
  );
}

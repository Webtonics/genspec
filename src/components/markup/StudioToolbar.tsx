import { ChevronLeft, ChevronRight, Hand, Maximize, MousePointer2, Redo2, ScanText, Shapes, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import type { Job } from '@/model/types';
import { useCanRedo, useCanUndo } from '@/store/markupHistoryStore';
import { stepHistory } from './actions';
import { MarkupIcon } from './MarkupGlyph';
import { useStudio } from './studioStore';
import { TOOL_GROUPS, type ToolDef } from './tools';

const Divider = () => <span className="mx-1.5 h-8 w-px shrink-0 bg-line" aria-hidden />;

function ToolButton({ def, active, onClick }: { def: ToolDef; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${def.label} tool`}
      aria-pressed={active}
      title={`${def.label} (${def.key})`}
      onClick={onClick}
      className={cx(
        'flex h-12 min-w-11 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 transition-colors',
        'focus-visible:outline-2 focus-visible:outline-primary',
        active ? 'bg-primary/10 ring-1 ring-primary/50' : 'hover:bg-surface-2',
      )}
    >
      {def.tool === 'select' ? (
        <MousePointer2 size={19} className={active ? 'text-primary' : 'text-ink'} />
      ) : def.tool === 'pan' ? (
        <Hand size={19} className={active ? 'text-primary' : 'text-ink'} />
      ) : (
        <MarkupIcon type={def.tool} className="size-6" />
      )}
      <span className={cx('hidden text-[10px] leading-none font-medium xl:block', active ? 'text-primary' : 'text-muted')}>
        {def.short}
      </span>
    </button>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors',
        'focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-35',
        active ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}

export function StudioToolbar({ job }: { job: Job }) {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const zoom = useStudio((s) => s.zoom);
  const zoomBy = useStudio((s) => s.zoomBy);
  const requestFit = useStudio((s) => s.requestFit);
  const pageNumber = useStudio((s) => s.pageNumber);
  const setPage = useStudio((s) => s.setPage);
  const showLegend = useStudio((s) => s.showLegend);
  const toggleLegend = useStudio((s) => s.toggleLegend);
  const panel = useStudio((s) => s.panel);
  const setPanel = useStudio((s) => s.setPanel);
  const canUndo = useCanUndo(job.id);
  const canRedo = useCanRedo(job.id);
  const pageCount = job.drawing?.pageCount ?? 1;

  return (
    <div className="flex h-16 shrink-0 items-center overflow-x-auto border-b border-line bg-surface px-3" role="toolbar" aria-label="Markup tools">
      {TOOL_GROUPS.map((group, i) => (
        <Fragment key={group[0].tool}>
          {i > 0 && <Divider />}
          <div className="flex gap-0.5">
            {group.map((def) => (
              <ToolButton key={def.tool} def={def} active={tool === def.tool} onClick={() => setTool(def.tool)} />
            ))}
          </div>
        </Fragment>
      ))}

      <div className="ml-auto flex items-center gap-0.5 pl-4">
        <button
          type="button"
          aria-pressed={panel === 'register'}
          title="AI reads the drawing: tags, design data and suggested test limits"
          data-testid="read-drawing"
          data-tour="read-drawing"
          onClick={() => setPanel(panel === 'register' ? 'properties' : 'register')}
          className={cx(
            'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors',
            'focus-visible:outline-2 focus-visible:outline-primary',
            panel === 'register' ? 'bg-primary/10 text-primary ring-1 ring-primary/50' : 'text-ink ring-1 ring-line hover:bg-surface-2',
          )}
        >
          <ScanText size={16} />
          Read drawing
        </button>
        <Divider />
        <ActionButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => stepHistory(job.id, 'undo')}>
          <Undo2 size={18} />
        </ActionButton>
        <ActionButton label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => stepHistory(job.id, 'redo')}>
          <Redo2 size={18} />
        </ActionButton>
        <Divider />
        {pageCount > 1 && (
          <>
            <ActionButton label="Previous page" disabled={pageNumber <= 1} onClick={() => setPage(pageNumber - 1)}>
              <ChevronLeft size={18} />
            </ActionButton>
            <span className="px-1 text-xs whitespace-nowrap text-muted tabular-nums">
              Page {pageNumber} of {pageCount}
            </span>
            <ActionButton label="Next page" disabled={pageNumber >= pageCount} onClick={() => setPage(pageNumber + 1)}>
              <ChevronRight size={18} />
            </ActionButton>
            <Divider />
          </>
        )}
        <ActionButton label="Zoom out (-)" onClick={() => zoomBy(0.8)}>
          <ZoomOut size={18} />
        </ActionButton>
        <button
          type="button"
          onClick={requestFit}
          title="Fit page (0)"
          className="h-9 w-14 shrink-0 cursor-pointer rounded-lg text-xs font-medium text-ink tabular-nums hover:bg-surface-2"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ActionButton label="Zoom in (+)" onClick={() => zoomBy(1.25)}>
          <ZoomIn size={18} />
        </ActionButton>
        <ActionButton label="Fit page (0)" onClick={requestFit}>
          <Maximize size={17} />
        </ActionButton>
        <Divider />
        <ActionButton label={showLegend ? 'Hide legend' : 'Show legend'} active={showLegend} onClick={toggleLegend}>
          <Shapes size={18} />
        </ActionButton>
      </div>
    </div>
  );
}

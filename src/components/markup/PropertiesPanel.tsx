import { Check, FileText, RotateCw, Sparkles, Trash, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { cx } from '@/lib/cx';
import { groupByType, isPolylineType, isRotatable } from '@/markup/ops';
import { MARKUP_TYPE_LABELS, VALVE_POSITION_LABELS } from '@/model/options';
import type { Job, Markup, MarkupType, ValvePosition } from '@/model/types';
import { Button, IconButton } from '../ui/Button';
import { clearAllMarkups, deleteSelected, rotateSelected, sectionForNewMarkups, updateSelected } from './actions';
import { acceptDraft } from './aiActions';
import { MarkupIcon, positionAbbrev } from './MarkupGlyph';
import { useStudio } from './studioStore';
import { TOOLS } from './tools';
import { useDrawingUpload } from './useDrawingUpload';

const fieldLabel = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted';
const control =
  'w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20';

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label className={fieldLabel} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

const SECTION_SELECT_ID = 'new-markup-section';

function NewMarkupSection({ job }: { job: Job }) {
  const choice = useStudio((s) => s.newSectionId);
  const setNewSection = useStudio((s) => s.setNewSection);
  return (
    <div className="border-b border-line px-4 py-3">
      <Field label="New markups go to" htmlFor={SECTION_SELECT_ID}>
        <select
          id={SECTION_SELECT_ID}
          value={sectionForNewMarkups(job, choice) ?? ''}
          onChange={(e) => setNewSection(e.target.value || null)}
          className={cx(control, 'h-8 cursor-pointer')}
        >
          {job.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="">Unassigned</option>
        </select>
      </Field>
    </div>
  );
}

/** Text field that commits on blur or Enter, so one edit is one undo step. */
function CommitInput({
  id,
  value,
  onCommit,
  multiline,
  placeholder,
  className,
}: {
  id: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => text !== value && onCommit(text);
  const props = {
    id,
    value: text,
    placeholder,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        setText(value);
        e.currentTarget.blur();
      }
      if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
  };
  return multiline ? (
    <textarea {...props} rows={3} className={cx(control, 'resize-y py-2 leading-snug', className)} />
  ) : (
    <input {...props} className={cx(control, 'h-9', className)} />
  );
}

const POSITION_ORDER: ValvePosition[] = ['open', 'closed', 'locked open', 'locked closed'];

function MarkupProperties({ job, markup }: { job: Job; markup: Markup }) {
  const select = useStudio((s) => s.select);
  const isLine = isPolylineType(markup.type);
  const p = markup.points[0];

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-sheet ring-1 ring-line">
          <MarkupIcon type={markup.type} className="size-9" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{MARKUP_TYPE_LABELS[markup.type]}</div>
          <div className="truncate font-mono text-lg font-semibold text-ink" data-testid="selected-tag">
            {markup.tag}
          </div>
        </div>
        <IconButton aria-label="Close properties" onClick={() => select(null)}>
          <X size={16} />
        </IconButton>
      </div>

      {markup.aiDraft && (
        <div className="rounded-lg border border-dashed border-ai-draft bg-ai-draft/5 p-3" data-testid="draft-banner">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ai-draft">
            <Sparkles size={13} />
            AI draft
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink">
            Placed by Mark up for me. Drag it onto the right spot and check the tag and details, then accept it.
          </p>
          {markup.notes && <p className="mt-1 text-xs leading-relaxed text-muted">AI reason: {markup.notes}</p>}
          <Button size="sm" variant="primary" className="mt-2 w-full" onClick={() => acceptDraft(job.id, markup.id)} data-testid="accept-draft">
            <Check size={13} />
            Accept
          </Button>
        </div>
      )}

      <Field label="Tag" htmlFor="markup-tag">
        <CommitInput id="markup-tag" value={markup.tag} onCommit={(tag) => updateSelected(job.id, { tag })} className="font-mono" />
        <p className="mt-1.5 text-xs text-muted">
          {markup.tagLocked ? (
            <>
              Fixed tag, kept when others renumber.{' '}
              <button type="button" className="cursor-pointer font-medium text-primary hover:underline" onClick={() => updateSelected(job.id, { tag: '' })}>
                Use auto tag
              </button>
            </>
          ) : (
            'Auto tag. Renumbers when markups of this type are deleted.'
          )}
        </p>
      </Field>

      {markup.type === 'valve' && (
        <Field label="Valve position">
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Valve position">
            {POSITION_ORDER.map((pos) => {
              const active = (markup.valvePosition ?? 'closed') === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => updateSelected(job.id, { valvePosition: pos })}
                  className={cx(
                    'h-8 cursor-pointer rounded-md border text-xs font-medium transition-colors',
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-line text-ink hover:bg-surface-2',
                  )}
                >
                  {VALVE_POSITION_LABELS[pos]}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted">With the Valve tool, click a marked valve to toggle open or closed.</p>
        </Field>
      )}

      <Field label="Test section" htmlFor="markup-section">
        <select
          id="markup-section"
          value={markup.sectionId ?? ''}
          onChange={(e) => updateSelected(job.id, { sectionId: e.target.value || undefined })}
          className={cx(control, 'h-9 cursor-pointer')}
        >
          <option value="">Unassigned</option>
          {job.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes" htmlFor="markup-notes">
        <CommitInput
          id="markup-notes"
          multiline
          value={markup.notes ?? ''}
          placeholder="e.g. 600# spectacle blind, confirm rating"
          onCommit={(notes) => updateSelected(job.id, { notes })}
        />
      </Field>

      {isRotatable(markup.type) && (
        <Field label="Orientation">
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => rotateSelected(job.id)}>
              <RotateCw size={14} />
              Rotate 90°
            </Button>
            <span className="text-xs text-muted">{markup.rotation ? 'On a vertical line' : 'On a horizontal line'} (R)</span>
          </div>
        </Field>
      )}

      <Field label="Position">
        <p className="font-mono text-xs text-muted">
          {isLine
            ? `${markup.points.length} points, page ${markup.page}`
            : `Page ${markup.page}, x ${p.x.toFixed(1)} pt, y ${p.y.toFixed(1)} pt`}
        </p>
      </Field>

      <Button variant="danger" className="w-full border border-line" onClick={() => deleteSelected(job.id)}>
        <Trash size={14} />
        Delete markup
      </Button>
    </div>
  );
}

const LIST_ORDER = TOOLS.map((t) => t.tool).filter((t): t is MarkupType => t !== 'select' && t !== 'pan');

function MarkupList({ job }: { job: Job }) {
  const focusMarkup = useStudio((s) => s.focusMarkup);
  const groups = groupByType(job.markups);

  return (
    <div className="p-4">
      <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
        Pick a tool and click on the drawing. Select a markup to edit its tag, section and notes. The lists and test pack
        update as you go.
      </p>

      {job.markups.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">No markups yet.</p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Markups</h3>
            <span className="text-xs text-muted" data-testid="markup-count">
              {job.markups.length} placed
            </span>
          </div>
          {LIST_ORDER.map((type) => {
            const items = groups.get(type);
            if (!items) return null;
            return (
              <section key={type}>
                <div className="mb-1.5 flex items-center gap-2">
                  <MarkupIcon type={type} className="size-5" />
                  <span className="text-xs font-semibold text-ink">{MARKUP_TYPE_LABELS[type]}</span>
                  <span className="ml-auto text-xs text-muted tabular-nums">{items.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => focusMarkup(m.id, m.page)}
                      title={m.aiDraft ? 'AI draft, not yet accepted' : undefined}
                      className={cx(
                        'cursor-pointer rounded-md border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary',
                        m.aiDraft ? 'border-dashed border-ai-draft' : 'border-line',
                      )}
                    >
                      {m.aiDraft && <span className="mr-1 font-sans text-[9px] font-bold text-ai-draft">AI</span>}
                      {m.tag}
                      {m.type === 'valve' && (
                        <span className="ml-1 font-sans font-normal text-muted">{positionAbbrev(m.valvePosition)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          <Button
            variant="danger"
            size="sm"
            onClick={() => window.confirm('Remove every markup from this drawing? You can undo this.') && clearAllMarkups(job.id)}
          >
            <Trash size={13} />
            Clear all markups
          </Button>
        </div>
      )}
    </div>
  );
}

function DrawingInfo({ job }: { job: Job }) {
  const upload = useDrawingUpload(job.id);
  if (!job.drawing) return null;
  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex items-center gap-2.5">
        <FileText size={16} className="shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-ink" title={job.drawing.fileName}>
            {job.drawing.fileName}
          </div>
          <div className="text-[11px] text-muted">
            {job.drawing.pageCount} {job.drawing.pageCount === 1 ? 'page' : 'pages'}, original kept unaltered
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={upload.open} disabled={upload.busy}>
          Replace
        </Button>
      </div>
      {upload.error && <p className="mt-2 text-xs text-red-600">{upload.error}</p>}
      {upload.input}
    </div>
  );
}

export function PropertiesPanel({ job }: { job: Job }) {
  const selectedId = useStudio((s) => s.selectedId);
  const selected = job.markups.find((m) => m.id === selectedId);
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-surface" aria-label="Markup properties">
      <NewMarkupSection job={job} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected ? <MarkupProperties key={selected.id} job={job} markup={selected} /> : <MarkupList job={job} />}
      </div>
      <DrawingInfo job={job} />
    </aside>
  );
}

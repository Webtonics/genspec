import { Crosshair, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/cx';
import { type ListRow, type Tone, displayValue, editTarget, storedValue } from '@/lists/buildLists';
import { type ListColumn, type ListDef } from '@/lists/definitions';
import { updateMarkup } from '@/markup/ops';
import type { Job, ValvePosition } from '@/model/types';
import { jobPath } from '@/navigation';
import { useListStore } from '@/store/listStore';
import { useMarkupHistory } from '@/store/markupHistoryStore';

const CELL =
  'h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-ink outline-none transition-colors ' +
  'placeholder:italic placeholder:text-muted/40 hover:border-line focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20';

const TONE: Record<Tone, string> = {
  red: 'bg-red-50 text-red-700 ring-red-600/25 scada:bg-red-500/10 scada:text-red-400 scada:ring-red-400/30',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/30 scada:bg-[#FFB020]/10 scada:text-[#FFB020] scada:ring-[#FFB020]/30',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/25 scada:bg-[#00E87B]/10 scada:text-[#00E87B] scada:ring-[#00E87B]/30',
  muted: 'text-muted ring-line',
};

/** Write one cell: markup fields through undo history, list fields to the list store. */
function writeCell(job: Job, def: ListDef, col: ListColumn, row: ListRow, value: string) {
  const target = editTarget(def.key, col, row.markup);
  if (!target) return;
  if (target.kind === 'markup') {
    const patch =
      target.field === 'sectionId'
        ? { sectionId: value || undefined }
        : target.field === 'valvePosition'
          ? { valvePosition: value as ValvePosition }
          : { [target.field]: value };
    useMarkupHistory.getState().commit(job.id, updateMarkup(job.markups, row.markup.id, patch));
  } else {
    useListStore.getState().setField(job.id, row.markup.id, col.key, storedValue(row, col.key, value));
  }
}

function TextCell({
  value,
  label,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  label: string;
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      aria-label={label}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(value);
          e.currentTarget.blur();
        }
      }}
      className={cx(CELL, className)}
    />
  );
}

function Cell({ job, def, col, row }: { job: Job; def: ListDef; col: ListColumn; row: ListRow }) {
  const value = row.values[col.key] ?? '';
  const label = `${col.header} for ${row.values.tag}`;
  const muted = row.defaulted[col.key] ? 'text-muted' : '';
  const commit = (v: string) => writeCell(job, def, col, row, v);

  switch (col.kind) {
    case 'index':
      return <span className="block px-2 text-center text-xs text-muted tabular-nums">{value}</span>;
    case 'readonly': {
      const tone = row.tones[col.key];
      if (tone && tone !== 'muted') {
        return (
          <span className={cx('ml-1 inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE[tone])}>
            {value}
          </span>
        );
      }
      return <span className={cx('block whitespace-nowrap px-2 text-sm', tone === 'muted' || !value ? 'text-muted' : 'text-ink')}>{value || 'n/a'}</span>;
    }
    case 'tag':
      return <TextCell value={value} label={label} onCommit={commit} className="font-mono text-[13px] font-semibold" />;
    case 'text':
      return (
        <TextCell
          value={value}
          label={label}
          placeholder={col.placeholder}
          onCommit={commit}
          className={cx(muted, col.align === 'center' && 'text-center')}
        />
      );
    case 'date':
      return <input type="date" aria-label={label} value={value} onChange={(e) => commit(e.target.value)} className={cx(CELL, 'tabular-nums')} />;
    case 'section':
      return (
        <select aria-label={label} value={value} onChange={(e) => commit(e.target.value)} className={cx(CELL, 'cursor-pointer')}>
          <option value="">Unassigned</option>
          {job.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      );
    case 'select':
      return (
        <select aria-label={label} value={value} onChange={(e) => commit(e.target.value)} className={cx(CELL, 'cursor-pointer', muted)}>
          {!col.options?.some((o) => o.value === value) && <option value={value}>{displayValue(col, row, job) || 'Choose'}</option>}
          {col.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
  }
}

function linkedTitle(def: ListDef, col: ListColumn): string | null {
  if (col.source === 'markup') return 'Linked to the markup: editing here edits the drawing';
  if (def.key === 'lineup' && col.key === 'test') return 'For valves this is the position on the drawing, so editing it edits the markup';
  return null;
}

/** Editable table for one list. Rows follow the markups; cells write straight back. */
export function ListTable({ job, def, rows }: { job: Job; def: ListDef; rows: ListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-sm font-medium text-ink">{def.empty}</p>
        <p className="mt-1 text-sm text-muted">Rows appear here as soon as they are placed on the drawing.</p>
        <Link
          to={jobPath(job.id, 'markup')}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
        >
          Open the Markup studio
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" data-testid={`list-${def.key}`}>
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {def.columns.map((col) => {
              const linked = linkedTitle(def, col);
              return (
                <th
                  key={col.key}
                  scope="col"
                  style={{ minWidth: Math.round(col.width * 7.4) }}
                  className={cx(
                    'px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-muted',
                    col.align === 'center' ? 'text-center' : 'text-left',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {linked && (
                      <span title={linked} className="text-primary">
                        <Link2 size={12} aria-label={linked} />
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
            <th className="w-10" aria-label="Show on drawing" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.markup.id} className="border-b border-line last:border-0 hover:bg-surface-2/60" data-tag={row.values.tag}>
              {def.columns.map((col) => (
                <td key={col.key} className="px-1 py-1 align-middle">
                  <Cell job={job} def={def} col={col} row={row} />
                </td>
              ))}
              <td className="px-1 py-1 text-center">
                <Link
                  to={`${jobPath(job.id, 'markup')}?focus=${encodeURIComponent(row.markup.id)}`}
                  title={`Show ${row.values.tag} on the drawing`}
                  aria-label={`Show ${row.values.tag} on the drawing`}
                  className="inline-grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-primary"
                >
                  <Crosshair size={15} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

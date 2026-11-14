/**
 * Builds every list row from the job's markups plus the extra fields saved in
 * the list store. Nothing is copied: rows are recomputed on each change, so the
 * lists always match the drawing.
 */
import type { JobCalc } from '@/calc';
import { fmtNumber, fmtValue } from '@/lib/format';
import { MARKUP_TYPE_LABELS } from '@/model/options';
import type { Job, Markup, MarkupType, ValvePosition } from '@/model/types';
import { LIST_BY_KEY, type ListColumn, type ListKey } from './definitions';

/** Extra list fields for one markup, by column key. */
export type ListFields = Record<string, string>;
/** Extra list fields for one job, by markup id. */
export type FieldsByMarkup = Record<string, ListFields>;

export type Tone = 'red' | 'amber' | 'green' | 'muted';

export type ListRow = {
  markup: Markup;
  /** Raw value for every column (section id, valve position key, ISO date...). */
  values: Record<string, string>;
  /** Defaults for list fields that have one. */
  defaults: Record<string, string>;
  /** True where the shown value is still the default rather than entered. */
  defaulted: Record<string, boolean>;
  /** Status colouring for derived cells. */
  tones: Record<string, Tone>;
};

export type Lists = Record<ListKey, ListRow[]>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a YYYY-MM-DD date as a local calendar day. */
export function parseDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Calibration status of a test instrument from its due date. */
export function calibrationStatus(calDue: string, today: Date): { label: string; tone: Tone } {
  const due = parseDay(calDue);
  if (!due) return { label: 'Not entered', tone: 'muted' };
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due.getTime() - start.getTime()) / DAY_MS);
  if (days < 0) return { label: 'Expired', tone: 'red' };
  if (days <= 30) return { label: 'Due within 30 days', tone: 'amber' };
  return { label: 'Valid', tone: 'green' };
}

/** Stage positions a vent, drain or fill point normally takes. */
const STAGE_DEFAULTS: Partial<Record<MarkupType, { fill: ValvePosition; test: ValvePosition; drain: ValvePosition }>> = {
  vent: { fill: 'open', test: 'closed', drain: 'open' },
  drain: { fill: 'closed', test: 'closed', drain: 'open' },
  fill: { fill: 'open', test: 'closed', drain: 'closed' },
};

/** Per-row extras: defaults for list fields, read-only derived values and status tones. */
type RowExtras = { defaults?: Record<string, string>; derived?: Record<string, string>; tones?: Record<string, Tone> };

const ITEM_LABELS: Partial<Record<MarkupType, string>> = {
  valve: 'Valve',
  fill: 'Fill point',
  vent: 'Vent',
  drain: 'Drain',
  gauge: 'Gauge',
  recorder: 'Recorder',
};

export function buildLists(job: Job, fields: FieldsByMarkup, calc: JobCalc, today: Date): Lists {
  const sectionNps = (m: Markup) => {
    const s = job.sections.find((x) => x.id === m.sectionId);
    return s ? fmtValue(s.nps) : '';
  };
  const testPressure = (m: Markup) => {
    const v = calc.sections.find((s) => s.sectionId === m.sectionId)?.values;
    if (v?.highPointBarg === undefined || v.lowPointBarg === undefined) return '';
    return `${fmtNumber(v.highPointBarg, 2)} to ${fmtNumber(v.lowPointBarg, 2)}`;
  };

  const rowsFor = (key: ListKey, extras: (m: Markup) => RowExtras): ListRow[] => {
    const def = LIST_BY_KEY[key];
    const markups = def.types.flatMap((t) => job.markups.filter((m) => m.type === t));
    return markups.map((m, i) => {
      const stored = fields[m.id] ?? {};
      const { defaults = {}, derived = {}, tones = {} } = extras(m);
      const values: Record<string, string> = {
        no: String(i + 1),
        tag: m.tag,
        section: m.sectionId ?? '',
        notes: m.notes ?? '',
        ...derived,
      };
      const defaulted: Record<string, boolean> = {};
      for (const col of def.columns) {
        if (col.source !== 'list' || col.key in derived) continue;
        const own = stored[col.key];
        values[col.key] = own ?? defaults[col.key] ?? '';
        defaulted[col.key] = own === undefined && col.key in defaults;
      }
      return { markup: m, values, defaults, defaulted, tones };
    });
  };

  return {
    blinds: rowsFor('blinds', (m) => ({
      defaults: { size: sectionNps(m), blindType: 'Spectacle blind', testPosition: 'Blind in' },
    })),

    ventsDrains: rowsFor('ventsDrains', (m) => ({
      defaults: {
        size: '2',
        purpose: m.type === 'vent' ? 'High point vent' : 'Low point drain',
        isolation: 'Valve and blind flange',
      },
      derived: { kind: MARKUP_TYPE_LABELS[m.type] },
    })),

    lineup: rowsFor('lineup', (m): RowExtras => {
      if (m.type === 'valve') {
        // The test position is the valve's state on the drawing. Fill and drain start the same.
        const test = m.valvePosition ?? 'closed';
        return { defaults: { fill: test, drain: test }, derived: { item: 'Valve', test } };
      }
      const stages = STAGE_DEFAULTS[m.type] ?? { fill: 'closed', test: 'closed', drain: 'closed' };
      return { defaults: { ...stages }, derived: { item: ITEM_LABELS[m.type] ?? m.type } };
    }),

    joints: rowsFor('joints', (m) => ({ defaults: { size: sectionNps(m) } })),

    instruments: rowsFor('instruments', (m) => {
      const status = calibrationStatus(fields[m.id]?.calDue ?? '', today);
      return {
        derived: { kind: ITEM_LABELS[m.type] ?? m.type, testPressure: testPressure(m), calStatus: status.label },
        tones: { calStatus: status.tone },
      };
    }),
  };
}

/** Text shown for a cell, on screen and in the export. */
export function displayValue(col: ListColumn, row: ListRow, job: Job): string {
  const raw = row.values[col.key] ?? '';
  switch (col.kind) {
    case 'section':
      return job.sections.find((s) => s.id === raw)?.name ?? 'Unassigned';
    case 'select':
      return col.options?.find((o) => o.value === raw)?.label ?? raw;
    case 'date': {
      const d = parseDay(raw);
      return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    }
    default:
      return raw;
  }
}

export type EditTarget =
  | { kind: 'markup'; field: 'tag' | 'sectionId' | 'notes' | 'valvePosition' }
  | { kind: 'list' }
  | null;

/**
 * Where an edit to a cell is written. Tag, section and notes are the markup's own
 * fields, and a valve's test position is its state on the drawing, so those edit
 * the markup. Everything else goes to the per-job list store.
 */
export function editTarget(listKey: ListKey, col: ListColumn, markup: Markup): EditTarget {
  if (col.source === 'derived') return null;
  if (col.source === 'markup') {
    return { kind: 'markup', field: col.key === 'tag' ? 'tag' : col.key === 'section' ? 'sectionId' : 'notes' };
  }
  if (listKey === 'lineup' && col.key === 'test' && markup.type === 'valve') return { kind: 'markup', field: 'valvePosition' };
  return { kind: 'list' };
}

/**
 * The value to store for a list-field edit: undefined when it matches the default
 * (so the default keeps following the job), otherwise what was entered.
 */
export function storedValue(row: ListRow, key: string, value: string): string | undefined {
  const fallback = row.defaults[key];
  if (fallback !== undefined) return value === fallback ? undefined : value;
  return value.trim() === '' ? undefined : value;
}

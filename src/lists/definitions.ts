/**
 * The five lists generated from the markups. Columns are shared by the Lists
 * page and the Excel export, so both always show the same fields.
 *
 * Column source:
 *   markup   the value lives on the markup (tag, section, notes); editing it edits the drawing
 *   list     extra fields stored per job in the list store, with defaults where sensible
 *   derived  read only, worked out from the job (row number, type, test pressure, status)
 */
import { VALVE_POSITION_LABELS, VALVE_POSITIONS } from '@/model/options';
import type { MarkupType } from '@/model/types';

export type ListKey = 'blinds' | 'ventsDrains' | 'lineup' | 'joints' | 'instruments';

export type Option = { value: string; label: string };

export type ColumnKind = 'index' | 'tag' | 'text' | 'select' | 'section' | 'date' | 'readonly';

export type ListColumn = {
  key: string;
  header: string;
  /** Excel column width in characters; also sets the minimum width on screen. */
  width: number;
  kind: ColumnKind;
  source: 'markup' | 'list' | 'derived';
  options?: Option[];
  placeholder?: string;
  align?: 'left' | 'center';
};

export type ListDef = {
  key: ListKey;
  title: string;
  sheetName: string;
  fileSlug: string;
  description: string;
  /** Markup types listed, in row order. */
  types: MarkupType[];
  empty: string;
  columns: ListColumn[];
};

const options = (...labels: string[]): Option[] => labels.map((label) => ({ value: label, label }));

export const POSITION_OPTIONS: Option[] = VALVE_POSITIONS.map((p) => ({ value: p, label: VALVE_POSITION_LABELS[p] }));

const no: ListColumn = { key: 'no', header: 'No.', width: 6, kind: 'index', source: 'derived', align: 'center' };
const tag = (header: string): ListColumn => ({ key: 'tag', header, width: 12, kind: 'tag', source: 'markup' });
const section: ListColumn = { key: 'section', header: 'Test section', width: 13, kind: 'section', source: 'markup' };
const notes: ListColumn = { key: 'notes', header: 'Notes', width: 36, kind: 'text', source: 'markup', placeholder: 'Add a note' };
const readonly = (key: string, header: string, width: number): ListColumn => ({ key, header, width, kind: 'readonly', source: 'derived' });
const text = (key: string, header: string, width: number, placeholder?: string, align?: 'center'): ListColumn => ({
  key,
  header,
  width,
  kind: 'text',
  source: 'list',
  placeholder,
  align,
});
const select = (key: string, header: string, width: number, opts: Option[]): ListColumn => ({
  key,
  header,
  width,
  kind: 'select',
  source: 'list',
  options: opts,
});
const date = (key: string, header: string, width: number): ListColumn => ({ key, header, width, kind: 'date', source: 'list' });

export const LIST_DEFS: ListDef[] = [
  {
    key: 'blinds',
    title: 'Blind list',
    sheetName: 'Blind list',
    fileSlug: 'Blind-list',
    description: 'Spectacle blinds and spades at the test limits, with their position for the test.',
    types: ['blind'],
    empty: 'No blinds marked up yet.',
    columns: [
      no,
      tag('Blind no.'),
      section,
      text('lineNo', 'Line no.', 16, '12"-EXP-001'),
      text('size', 'Size (in)', 9, '', 'center'),
      text('rating', 'Rating', 12, 'ASME 600'),
      select('blindType', 'Type', 17, options('Spectacle blind', 'Spade', 'Spacer', 'Blind flange')),
      select('testPosition', 'Position for test', 16, options('Blind in', 'Spacer in')),
      text('installedBy', 'Installed by', 15, 'Name, date'),
      text('removedBy', 'Removed by', 15, 'Name, date'),
      notes,
    ],
  },
  {
    key: 'ventsDrains',
    title: 'Vent and drain list',
    sheetName: 'Vents and drains',
    fileSlug: 'Vent-and-drain-list',
    description: 'High point vents and low point drains used to fill, test and dewater each section.',
    types: ['vent', 'drain'],
    empty: 'No vents or drains marked up yet.',
    columns: [
      no,
      tag('Tag'),
      readonly('kind', 'Type', 9),
      section,
      text('lineNo', 'Line no.', 16, '12"-EXP-001'),
      text('size', 'Size (in)', 9, '', 'center'),
      select('purpose', 'Purpose', 17, options('High point vent', 'Low point drain', 'Vent', 'Drain', 'Bleed')),
      text('isolation', 'Isolation', 22),
      notes,
    ],
  },
  {
    key: 'lineup',
    title: 'Valve line-up',
    sheetName: 'Valve line-up',
    fileSlug: 'Valve-line-up',
    description: 'Position of every valve, vent, drain and fill point for each stage. Test positions of valves are the ones on the drawing.',
    types: ['valve', 'fill', 'vent', 'drain'],
    empty: 'No valves, vents, drains or fill points marked up yet.',
    columns: [
      no,
      tag('Tag'),
      readonly('item', 'Item', 11),
      section,
      select('fill', 'Fill', 15, POSITION_OPTIONS),
      select('test', 'Test', 15, POSITION_OPTIONS),
      select('drain', 'Drain', 15, POSITION_OPTIONS),
      notes,
    ],
  },
  {
    key: 'joints',
    title: 'Joint register',
    sheetName: 'Joint register',
    fileSlug: 'Joint-register',
    description: 'Flanged joints broken for the test, in the style of an ASME PCC-1 joint record.',
    types: ['joint'],
    empty: 'No joints marked up yet.',
    columns: [
      no,
      tag('Joint no.'),
      section,
      text('size', 'Size (in)', 9, '', 'center'),
      text('rating', 'Rating', 12, 'ASME 600'),
      text('gasket', 'Gasket', 20, 'SW 316 / graphite'),
      text('boltSize', 'Bolt size', 15, '1-1/4" x 20'),
      text('target', 'Target torque / tension', 18, 'e.g. 1,250 N·m'),
      text('brokenBy', 'Broken by', 14, 'Name'),
      text('reinstatedBy', 'Reinstated by', 14, 'Name'),
      date('date', 'Date', 14),
      text('signOff', 'Sign-off', 12, 'Initials'),
    ],
  },
  {
    key: 'instruments',
    title: 'Gauge and recorder list',
    sheetName: 'Gauges and recorders',
    fileSlug: 'Gauge-and-recorder-list',
    description: 'Temporary test instruments with their calibration certificates and due dates.',
    types: ['gauge', 'recorder'],
    empty: 'No gauges or recorders marked up yet.',
    columns: [
      no,
      tag('Tag'),
      readonly('kind', 'Type', 11),
      section,
      readonly('testPressure', 'Section test pressure (barg)', 20),
      text('range', 'Range', 15, '0 to 250 barg'),
      text('serialNo', 'Serial no.', 14),
      text('certNo', 'Calibration cert no.', 18),
      date('calDue', 'Calibration due', 15),
      readonly('calStatus', 'Calibration status', 18),
      notes,
    ],
  },
];

export const LIST_BY_KEY = Object.fromEntries(LIST_DEFS.map((d) => [d.key, d])) as Record<ListKey, ListDef>;

export const LIST_KEYS: ListKey[] = LIST_DEFS.map((d) => d.key);

export const isListKey = (value: string | null): value is ListKey => value !== null && value in LIST_BY_KEY;

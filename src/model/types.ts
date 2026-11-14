/**
 * GenSpec job data model.
 *
 * One Job is the single source of truth for a pre-commissioning job. Drawings,
 * markups, lists and calculations are all generated from it, so they always agree.
 */

export type Medium = 'inhibited water' | 'nitrogen' | 'air';

export type TestCode = 'ASME B31.3' | 'ASME B31.4' | 'ASME B31.8' | 'Client spec';

export type JobStatus = 'FOR REVIEW' | 'APPROVED';

/** The client's original drawing. Stored unaltered: markups live in a separate overlay layer. */
export type Drawing = {
  fileName: string;
  pdfBase64: string;
  pageCount: number;
};

export type Job = {
  id: string;
  title: string;
  client: string;
  jobNo: string;
  medium: Medium;
  code: TestCode;
  sections: TestSection[];
  drawing?: Drawing;
  markups: Markup[];
  status: JobStatus;
  approvedBy?: string;
  /** ISO 8601 timestamp, stamped when an engineer approves. */
  approvedAt?: string;
  /** A, B, C... */
  revision: string;
  /** Per-job calculation choices. Anything unset falls back to the rule defaults in Settings. */
  calcOptions?: JobCalcOptions;
  /** ISO 8601, when the job (revision A) was created. */
  createdAt?: string;
  /** Client comments and approvals, oldest first. Feeds the revision table and revision clouds. */
  history?: RevisionEvent[];
};

/**
 * A client comment raises the revision letter and sends the job back for review;
 * an approval stamps the engineer's name and time on the current revision.
 */
export type RevisionEvent =
  | { kind: 'comment'; rev: string; at: string; text: string; markupId?: string }
  | { kind: 'approval'; rev: string; at: string; by: string };

export type JobCalcOptions = {
  /** Pump preset used for fill time. */
  pumpId?: string;
  /** Line volumes of nitrogen for the purge. */
  purgeVolumes?: number;
  /** Nitrogen packing pressure, barg. */
  packingPressureBarg?: number;
};

export type TestSection = {
  id: string;
  /** e.g. TP-012 */
  name: string;
  /** Nominal pipe size, inches. */
  nps: number;
  odMm: number;
  wtMm: number;
  lengthM: number;
  designPressureBarg: number;
  maxAllowableTestBarg: number;
  highPointElevM: number;
  lowPointElevM: number;
  holdHours: number;
};

export type MarkupType =
  | 'boundary'
  | 'blind'
  | 'vent'
  | 'drain'
  | 'fill'
  | 'gauge'
  | 'recorder'
  | 'valve'
  | 'purgeRoute'
  | 'joint';

export type ValvePosition = 'open' | 'closed' | 'locked closed' | 'locked open';

/**
 * A position on a drawing page in PDF points (1/72 inch), measured from the
 * top-left corner of the page with y increasing downwards, so it maps directly
 * onto the SVG overlay at any zoom. Flipped to PDF's bottom-left origin only at export.
 */
export type Point = { x: number; y: number };

export type Markup = {
  id: string;
  type: MarkupType;
  /** 1-based page number in the drawing. */
  page: number;
  /** Symbols use one point; boundary and purgeRoute are polylines. */
  points: Point[];
  /** Auto-numbered per type: B1.., V1.., D1.., F1, PI-101.., PR-101.., MV-1.., J-001.. */
  tag: string;
  valvePosition?: ValvePosition;
  sectionId?: string;
  notes?: string;
  /** The tag was typed by the engineer or read from the drawing, so renumbering leaves it alone. */
  tagLocked?: boolean;
  /** Symbol rotation in degrees (0 or 90) for valves, blinds and joints on vertical lines. */
  rotation?: number;
};

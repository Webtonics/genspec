import type { JobStatus, MarkupType, Medium, TestCode, ValvePosition } from './types';

// Display labels for every union member. Typed as Record so adding a member to a
// union in types.ts is a compile error here until it gets a label.

export const MEDIUM_LABELS: Record<Medium, string> = {
  'inhibited water': 'Inhibited water',
  nitrogen: 'Nitrogen',
  air: 'Air',
};

export const TEST_CODE_LABELS: Record<TestCode, string> = {
  'ASME B31.3': 'ASME B31.3 (process piping)',
  'ASME B31.4': 'ASME B31.4 (liquid pipelines)',
  'ASME B31.8': 'ASME B31.8 (gas pipelines)',
  'Client spec': 'Client specification',
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  'FOR REVIEW': 'For review',
  APPROVED: 'Approved',
};

export const VALVE_POSITION_LABELS: Record<ValvePosition, string> = {
  open: 'Open',
  closed: 'Closed',
  'locked closed': 'Locked closed',
  'locked open': 'Locked open',
};

export const MARKUP_TYPE_LABELS: Record<MarkupType, string> = {
  boundary: 'Test boundary',
  blind: 'Blind',
  vent: 'Vent',
  drain: 'Drain',
  fill: 'Fill point',
  gauge: 'Pressure gauge',
  recorder: 'Pressure recorder',
  valve: 'Valve',
  purgeRoute: 'Purge route',
  joint: 'Flanged joint',
};

const keys = <K extends string>(record: Record<K, unknown>) => Object.keys(record) as K[];

export const MEDIA = keys(MEDIUM_LABELS);
export const TEST_CODES = keys(TEST_CODE_LABELS);
export const VALVE_POSITIONS = keys(VALVE_POSITION_LABELS);
export const MARKUP_TYPES = keys(MARKUP_TYPE_LABELS);

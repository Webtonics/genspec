import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  ListChecks,
  PenTool,
  Settings,
  Workflow,
} from 'lucide-react';

/** Pages that belong to one job, routed as /jobs/:jobId/<key>. */
export type JobPageKey = 'setup' | 'markup' | 'lists' | 'calculations' | 'spread' | 'test-pack';

export type JobPage = {
  key: JobPageKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

/** Keyed by page so every JobPageKey must have an entry. Order here is sidebar order. */
export const JOB_PAGE_BY_KEY: Record<JobPageKey, JobPage> = {
  setup: {
    key: 'setup',
    label: 'Job setup',
    icon: ClipboardList,
    description: 'Job details, test medium, governing code and the test sections.',
  },
  markup: {
    key: 'markup',
    label: 'Markup studio',
    icon: PenTool,
    description: 'Mark up the client drawing with test boundaries, blinds, vents, drains and instruments.',
  },
  lists: {
    key: 'lists',
    label: 'Lists',
    icon: ListChecks,
    description: 'Blind, vent and drain, valve line-up, joint and gauge lists, generated live from the markups.',
  },
  calculations: {
    key: 'calculations',
    label: 'Calculations',
    icon: Calculator,
    description: 'Volumes, fill times and test pressures for each test section, with the working shown.',
  },
  spread: {
    key: 'spread',
    label: 'Spread diagrams',
    icon: Workflow,
    description: 'Rule-based P&ID of the temporary flooding, purge or dewatering spread.',
  },
  'test-pack': {
    key: 'test-pack',
    label: 'Test pack',
    icon: FileStack,
    description: 'One combined PDF test pack, watermarked FOR REVIEW until an engineer approves it.',
  },
};

export const JOB_PAGES: readonly JobPage[] = Object.values(JOB_PAGE_BY_KEY);

export const DASHBOARD_NAV = { label: 'Dashboard', path: '/', icon: LayoutDashboard } as const;
export const SETTINGS_NAV = { label: 'Settings', path: '/settings', icon: Settings } as const;

export function jobPath(jobId: string, page: JobPageKey = 'markup'): string {
  return `/jobs/${encodeURIComponent(jobId)}/${page}`;
}

export function getJobPage(key: string | undefined): JobPage | undefined {
  return JOB_PAGES.find((p) => p.key === key);
}

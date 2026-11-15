import { create } from 'zustand';
import { useStudio } from '@/components/markup/studioStore';
import { DEMO_JOB_IDS } from '@/model/seed';
import { jobPath } from '@/navigation';
import { useJobStore } from '@/store/jobStore';
import { resolveSpreadParams, useSpreadStore } from '@/store/spreadStore';
import { canPlaceDemoMarkups, placeDemoMarkups } from './demoMarkups';

export type TourAction = {
  label: string;
  /** Run the action; return a short confirmation to show. */
  run: () => string;
  /** Hidden when not applicable (e.g. markups already placed). */
  available: () => boolean;
};

export type TourStep = {
  route: string;
  /** data-tour value of the element to spotlight. */
  target: string;
  title: string;
  body: string;
  action?: TourAction;
  onEnter?: () => void;
  /** Only shown when the server has AI switched on. */
  requiresAi?: boolean;
};

const JOB = DEMO_JOB_IDS.hydrotest;
const demoJob = () => useJobStore.getState().jobs.find((j) => j.id === JOB);

export const TOUR_STEPS: TourStep[] = [
  {
    route: '/',
    target: 'demo-job',
    title: 'One job, one source of truth',
    body: 'A job holds the client drawing, the test sections and the markups. Every list, calculation, diagram and document is generated from it, so they always agree.',
  },
  {
    route: jobPath(JOB, 'markup'),
    target: 'drawing',
    title: 'Mark up the client P&ID',
    body: "The client's PDF is never altered: markups sit on their own layer. Place the test boundary, blinds, vents, drains, fill point and gauges from the toolbar. Valve tags are read straight off the drawing.",
    action: {
      label: 'Place a full set of markups for me',
      available: () => {
        const job = demoJob();
        return Boolean(job && job.markups.length === 0 && canPlaceDemoMarkups(job));
      },
      run: () => {
        const n = placeDemoMarkups(JOB);
        return n ? `Placed ${n} markups. Ctrl+Z takes them off again.` : 'Markups could not be placed on this drawing.';
      },
    },
  },
  {
    route: jobPath(JOB, 'markup'),
    target: 'read-drawing',
    requiresAi: true,
    title: 'AI reads and marks up the drawing',
    body: 'The AI reads the page, scanned or not: line numbers, valves, instruments and the design data in the notes, checked against the test section. Mark up for me then places its suggested test limits on the sheet as AI drafts, snapped to the lines. The engineer moves, deletes or accepts each one, and cannot approve until all are accepted.',
    action: {
      label: 'Read the drawing and mark it up',
      available: () => !demoJob()?.markups.some((m) => m.aiDraft),
      run: () => {
        useStudio.getState().setPanel('register');
        // Loaded on demand: the AI actions pull in the PDF renderer.
        void import('@/components/markup/aiActions').then(async ({ hasRegister, markUpForMe, readPage }) => {
          if (hasRegister(JOB, 1)) await markUpForMe(JOB, 1);
          else await readPage(JOB, 1, { thenMarkUp: true });
        });
        return 'Working on it. The drafts appear on the sheet with a dashed AI outline; accept them in the panel on the right.';
      },
    },
  },
  {
    route: jobPath(JOB, 'lists'),
    target: 'list-tabs',
    title: 'Every list, live',
    body: 'The blind list, vent and drain list, valve line-up, joint register and gauge list are built from the markups as they are placed. Edit a tag or note here and the drawing follows. One click exports Excel.',
  },
  {
    route: jobPath(JOB, 'calculations'),
    target: 'calc-summary',
    title: 'Calculations with the working shown',
    body: 'Volumes, fill times and test pressures come from fixed formulas and editable rule tables, never from AI. TP-012 is flagged AMBER: its low point test pressure is within 5% of the max allowable.',
  },
  {
    route: jobPath(JOB, 'spread'),
    target: 'spread-diagram',
    title: 'Spread diagrams laid out by rules',
    body: 'Pick a template and the temporary spread is drawn as a P&ID with ISA instrument bubbles, legend, notes and title block. This is the nitrogen purge spread, with purge and packing volumes from the calculations.',
    onEnter: () => {
      const job = demoJob();
      if (!job) return;
      const { byJob, setParams } = useSpreadStore.getState();
      setParams(JOB, { ...resolveSpreadParams(job, byJob[JOB]), template: 'nitrogen' });
    },
  },
  {
    route: jobPath(JOB, 'test-pack'),
    target: 'testpack-generate',
    title: 'One click, one test pack',
    body: 'The cover sheet, marked-up drawing, calculations, all five lists and the sign-off sheet in one PDF. Every page carries a title block and a FOR REVIEW watermark until an engineer approves it.',
    action: {
      label: 'Generate the test pack',
      available: () => true,
      run: () => {
        document.querySelector<HTMLButtonElement>('[data-tour="testpack-generate"]')?.click();
        return 'Building the PDF. It downloads and the pages appear below.';
      },
    },
  },
  {
    route: jobPath(JOB, 'test-pack'),
    target: 'approval',
    title: 'Approve it',
    body: 'Type the engineer name and approve. Every title block changes from FOR REVIEW to APPROVED with the name and date, and the watermark goes. A client comment raises the revision and clouds the change.',
  },
];

type TourState = {
  active: boolean;
  step: number;
  start: () => void;
  go: (step: number) => void;
  stop: () => void;
};

export const useTour = create<TourState>()((set) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  go: (step) => set({ step: Math.max(step, 0) }),
  stop: () => set({ active: false, step: 0 }),
}));

/** The steps for this server: the AI step only when AI is switched on. */
export function tourSteps(aiEnabled: boolean): TourStep[] {
  return TOUR_STEPS.filter((s) => !s.requiresAi || aiEnabled);
}

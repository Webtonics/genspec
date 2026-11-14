/**
 * A full set of markups on the sample P&ID, at the positions of its drawn items,
 * so the guided demo can show lists, calculations and the test pack without
 * placing each symbol by hand. Placed as one undoable step.
 */
import { createMarkup } from '@/markup/ops';
import { SAMPLE_PID_FILE_NAME } from '@/model/samplePid.generated';
import type { Job, Markup, MarkupType, Point, ValvePosition } from '@/model/types';
import { useJobStore } from '@/store/jobStore';
import { useMarkupHistory } from '@/store/markupHistoryStore';

/** Positions only make sense on the sample drawing. */
export const canPlaceDemoMarkups = (job: Job) => job.drawing?.fileName === SAMPLE_PID_FILE_NAME;

export function placeDemoMarkups(jobId: string): number {
  const job = useJobStore.getState().jobs.find((j) => j.id === jobId);
  if (!job || !canPlaceDemoMarkups(job)) return 0;
  const sectionId = job.sections[0]?.id;
  let markups: Markup[] = job.markups;
  const add = (type: MarkupType, points: Point[], extra: { tag?: string; valvePosition?: ValvePosition } = {}) => {
    markups = createMarkup(markups, { type, page: 1, points, sectionId, ...extra }).markups;
  };

  add('boundary', [
    { x: 395, y: 288 },
    { x: 925, y: 288 },
    { x: 925, y: 432 },
    { x: 395, y: 432 },
  ]);
  add('valve', [{ x: 410, y: 360 }], { tag: 'MV-101' });
  add('valve', [{ x: 910, y: 360 }], { tag: 'MV-102' });
  add('blind', [{ x: 430, y: 360 }]);
  add('blind', [{ x: 893, y: 360 }]);
  add('fill', [{ x: 470, y: 360 }]);
  add('gauge', [{ x: 528, y: 360 }]);
  add('recorder', [{ x: 600, y: 360 }]);
  add('vent', [{ x: 640, y: 360 }]);
  add('drain', [{ x: 770, y: 360 }]);
  add('gauge', [{ x: 858, y: 360 }]);
  add('joint', [{ x: 935, y: 360 }]);

  const added = markups.length - job.markups.length;
  useMarkupHistory.getState().commit(jobId, markups);
  return added;
}

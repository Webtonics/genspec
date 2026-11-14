import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { cx } from '@/lib/cx';
import { makeSampleDrawing } from '@/model/seed';
import type { Job } from '@/model/types';
import { useJobStore } from '@/store/jobStore';
import { JobPageHeader } from '../JobPageHeader';
import { Button } from '../ui/Button';
import { Page } from '../ui/Page';
import { useDrawingUpload } from './useDrawingUpload';

/** Empty state: attach the client's PDF by upload or drop, or use the sample P&ID. */
export function NoDrawing({ job }: { job: Job }) {
  const upload = useDrawingUpload(job.id);
  const updateJob = useJobStore((s) => s.updateJob);
  const [over, setOver] = useState(false);

  return (
    <Page>
      <JobPageHeader job={job} pageKey="markup" />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload.accept(e.dataTransfer.files[0]);
        }}
        className={cx(
          'mx-auto mt-4 max-w-xl rounded-xl border-2 border-dashed bg-surface px-8 py-12 text-center transition-colors',
          over ? 'border-primary bg-primary/5' : 'border-line-strong',
        )}
      >
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-muted ring-1 ring-line">
          <FileUp size={22} />
        </span>
        <h2 className="mt-4 text-base font-semibold text-ink">Attach the client drawing</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Drop the client P&amp;ID here or upload it as a PDF. It is stored unaltered and markups go on a separate layer.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="primary" onClick={upload.open} disabled={upload.busy}>
            Upload PDF
          </Button>
          <Button onClick={() => updateJob(job.id, { drawing: makeSampleDrawing() })}>Use the sample P&amp;ID</Button>
        </div>
        {upload.error && <p className="mt-4 text-sm text-red-600">{upload.error}</p>}
        {upload.input}
      </div>
    </Page>
  );
}

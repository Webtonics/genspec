import { fmtDate } from '@/lib/format';
import { revisionRows } from '@/model/revision';
import type { Job } from '@/model/types';
import { useTitleBlock } from '@/store/settingsStore';
import { Card, CardHeader } from '../ui/Page';

/** Revision table: first issue, client comments and approvals, newest first. */
export function RevisionHistory({ job }: { job: Job }) {
  const { company } = useTitleBlock();
  const rows = revisionRows(job, company).reverse();
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Revision history" />
      <ol className="divide-y divide-line">
        {rows.map((r, i) => (
          <li key={i} className="flex gap-3 px-5 py-3 text-sm">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-md font-mono text-xs font-bold ${
                r.rev === job.revision ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-muted ring-1 ring-line'
              }`}
            >
              {r.rev}
            </span>
            <div className="min-w-0">
              <div className="leading-snug text-ink">{r.description}</div>
              <div className="mt-0.5 text-xs text-muted">
                {r.by}
                {r.at ? ` · ${fmtDate(r.at)}` : ''}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

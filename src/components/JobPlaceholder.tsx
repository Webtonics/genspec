import type { ReactNode } from 'react';
import { useCurrentJob } from '@/hooks/useCurrentJob';
import { plural } from '@/lib/format';
import { MEDIUM_LABELS } from '@/model/options';
import { JOB_PAGE_BY_KEY, type JobPageKey } from '@/navigation';
import { JobPageHeader } from './JobPageHeader';
import { Page } from './ui/Page';
import { PlaceholderPanel } from './ui/PlaceholderPanel';

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

/** Header, job facts and feature list for a job page that is not built yet. */
export function JobPlaceholder({
  pageKey,
  features,
  children,
}: {
  pageKey: JobPageKey;
  features: string[];
  children?: ReactNode;
}) {
  const job = useCurrentJob();
  const page = JOB_PAGE_BY_KEY[pageKey];

  return (
    <Page>
      <JobPageHeader job={job} pageKey={pageKey} />
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-sm md:grid-cols-4">
          <Fact label="Drawing" value={job.drawing ? job.drawing.fileName : 'Not attached'} />
          <Fact label="Markups" value={plural(job.markups.length, 'item')} />
          <Fact label="Test sections" value={job.sections.map((s) => s.name).join(', ') || 'None'} />
          <Fact label="Medium and code" value={`${MEDIUM_LABELS[job.medium]}, ${job.code}`} />
        </dl>
        <PlaceholderPanel icon={page.icon} features={features} />
        {children}
      </div>
    </Page>
  );
}

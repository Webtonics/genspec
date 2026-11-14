import type { ReactNode } from 'react';
import type { Job } from '@/model/types';
import { JOB_PAGE_BY_KEY, type JobPageKey } from '@/navigation';
import { PageHeader } from './ui/Page';
import { StatusChip } from './ui/StatusChip';

/** Page header for a job screen: job number, revision and client above the page title. */
export function JobPageHeader({ job, pageKey, actions }: { job: Job; pageKey: JobPageKey; actions?: ReactNode }) {
  const page = JOB_PAGE_BY_KEY[pageKey];
  return (
    <PageHeader
      eyebrow={`${job.jobNo} · Rev ${job.revision}${job.client ? ` · ${job.client}` : ''}`}
      title={page.label}
      description={page.description}
      actions={
        <>
          {actions}
          <StatusChip status={job.status} />
        </>
      }
    />
  );
}

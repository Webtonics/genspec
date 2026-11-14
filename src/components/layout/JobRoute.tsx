import { ArrowLeft, SearchX } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useJob, useJobStore } from '@/store/jobStore';
import { buttonClass } from '../ui/Button';
import { Page } from '../ui/Page';

/**
 * Guard for /jobs/:jobId/*. Shows a not-found state for unknown ids and marks the
 * job as active so the sidebar follows it. Pages below can call useCurrentJob().
 */
export function JobRoute() {
  const { jobId } = useParams();
  const job = useJob(jobId);
  const setActiveJob = useJobStore((s) => s.setActiveJob);
  const exists = Boolean(job);

  useEffect(() => {
    if (exists && jobId) setActiveJob(jobId);
  }, [exists, jobId, setActiveJob]);

  if (!job) {
    return (
      <Page>
        <div className="mx-auto mt-16 max-w-md text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface text-muted ring-1 ring-line">
            <SearchX size={22} />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-ink">Job not found</h1>
          <p className="mt-1 text-sm text-muted">
            This job is not stored in this browser. It may have been deleted, or the demo data was reset.
          </p>
          <Link to="/" className={`${buttonClass('secondary')} mt-6`}>
            <ArrowLeft size={16} />
            Back to jobs
          </Link>
        </div>
      </Page>
    );
  }

  return <Outlet />;
}

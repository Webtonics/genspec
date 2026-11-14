import { ChevronRight } from 'lucide-react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { DASHBOARD_NAV, SETTINGS_NAV, getJobPage, jobPath } from '@/navigation';
import { useJob, useJobStore } from '@/store/jobStore';
import { ModeToggle } from './ModeToggle';

function Crumb({ to, children }: { to?: string; children: string }) {
  return to ? (
    <Link to={to} className="truncate text-muted transition-colors hover:text-ink">
      {children}
    </Link>
  ) : (
    <span className="truncate font-medium text-ink">{children}</span>
  );
}

const Sep = () => <ChevronRight size={14} className="shrink-0 text-line-strong" aria-hidden />;

export function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const jobs = useJobStore((s) => s.jobs);

  // The header sits above the job routes, so read the job id from the URL directly.
  const jobMatch = matchPath('/jobs/:jobId/:page', pathname);
  const job = useJob(jobMatch?.params.jobId);
  const jobPage = getJobPage(jobMatch?.params.page);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {job && jobPage ? (
          <>
            <Crumb to="/">Jobs</Crumb>
            <Sep />
            <Crumb to={jobPath(job.id, 'setup')}>{job.jobNo}</Crumb>
            <Sep />
            <Crumb>{jobPage.label}</Crumb>
          </>
        ) : pathname.startsWith(SETTINGS_NAV.path) ? (
          <Crumb>{SETTINGS_NAV.label}</Crumb>
        ) : (
          <Crumb>{pathname === '/' ? DASHBOARD_NAV.label : 'Not found'}</Crumb>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        {job && jobPage && jobs.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <span className="hidden lg:inline">Job</span>
            <select
              value={job.id}
              onChange={(e) => navigate(jobPath(e.target.value, jobPage.key))}
              className="h-8 max-w-64 cursor-pointer truncate rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNo}: {j.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <ModeToggle />
      </div>
    </header>
  );
}

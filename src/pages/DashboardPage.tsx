import { FileStack, PenTool, PlayCircle, Plus, RotateCcw, Trash } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type Flag, calculateJob } from '@/calc';
import { Button, IconButton, buttonClass } from '@/components/ui/Button';
import { FlagChip } from '@/components/ui/FlagChip';
import { Page, PageHeader } from '@/components/ui/Page';
import { StatusChip } from '@/components/ui/StatusChip';
import { useTour } from '@/demo/tour';
import { fmtDate, fmtNumber } from '@/lib/format';
import { MEDIUM_LABELS } from '@/model/options';
import { DEMO_JOB_IDS } from '@/model/seed';
import type { Job } from '@/model/types';
import { jobPath } from '@/navigation';
import { useJobStore } from '@/store/jobStore';
import { useRules } from '@/store/settingsStore';

const totalLengthKm = (jobs: Job[]) =>
  jobs.reduce((sum, job) => sum + job.sections.reduce((s, sec) => s + sec.lengthM, 0), 0) / 1000;

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4 shadow-sm">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

function Metric({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 bg-surface px-3.5 py-2.5${wide ? ' col-span-2' : ''}`}>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function JobCard({ job, flag, onDelete }: { job: Job; flag: Flag | null; onDelete: () => void }) {
  return (
    <article
      data-tour={job.id === DEMO_JOB_IDS.hydrotest ? 'demo-job' : undefined}
      className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:border-line-strong hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted">
            {job.jobNo} · Rev {job.revision}
          </div>
          <h3 className="mt-1 text-base font-semibold leading-snug text-ink">
            <Link to={jobPath(job.id, 'markup')} className="hover:text-primary">
              {job.title}
            </Link>
          </h3>
          <div className="mt-0.5 text-sm text-muted">{job.client || 'No client set'}</div>
        </div>
        <StatusChip status={job.status} />
      </div>

      <dl className="grid grid-cols-4 gap-px border-y border-line bg-line">
        <Metric label="Medium" value={MEDIUM_LABELS[job.medium]} wide />
        <Metric label="Code" value={job.code} wide />
        <Metric label="Sections" value={job.sections.length} />
        <Metric label="Length" value={`${fmtNumber(totalLengthKm([job]), 2)} km`} />
        <Metric label="Markups" value={job.markups.length} />
        <Metric label="Drawing" value={job.drawing ? `${job.drawing.pageCount} pg` : 'None'} />
      </dl>

      <div className="flex items-center justify-between gap-3 px-5 pt-3 text-xs text-muted">
        <span className="truncate">
          {job.status === 'APPROVED' && job.approvedBy
            ? `Approved by ${job.approvedBy}${job.approvedAt ? ` on ${fmtDate(job.approvedAt)}` : ''}`
            : 'Awaiting engineer approval'}
        </span>
        {job.sections.length > 0 && (
          <Link to={jobPath(job.id, 'calculations')} className="shrink-0" title="Worst calculation flag across the test sections">
            <FlagChip flag={flag} />
          </Link>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 px-5 pt-3 pb-4">
        <Link to={jobPath(job.id, 'markup')} className={buttonClass('primary', 'sm')}>
          <PenTool size={14} />
          Markup studio
        </Link>
        <Link to={jobPath(job.id, 'test-pack')} className={buttonClass('secondary', 'sm')}>
          <FileStack size={14} />
          Test pack
        </Link>
        <Link to={jobPath(job.id, 'setup')} className={buttonClass('ghost', 'sm')}>
          Setup
        </Link>
        <IconButton variant="danger" className="ml-auto" aria-label={`Delete job ${job.jobNo}`} title="Delete job" onClick={onDelete}>
          <Trash size={15} />
        </IconButton>
      </div>
    </article>
  );
}

export function DashboardPage() {
  const jobs = useJobStore((s) => s.jobs);
  const createJob = useJobStore((s) => s.createJob);
  const deleteJob = useJobStore((s) => s.deleteJob);
  const resetDemoData = useJobStore((s) => s.resetDemoData);
  const rules = useRules();
  const startTour = useTour((s) => s.start);
  const navigate = useNavigate();
  const flags = useMemo(() => new Map(jobs.map((j) => [j.id, calculateJob(j, rules).worst])), [jobs, rules]);

  const newJob = () => navigate(jobPath(createJob().id, 'setup'));
  const startDemo = () => {
    if (!jobs.some((j) => j.id === DEMO_JOB_IDS.hydrotest)) {
      if (!window.confirm('The guided demo runs on the demo export line job, which is not here. Restore the two demo jobs?')) return;
      resetDemoData();
    }
    startTour();
  };
  const confirmDelete = (job: Job) => {
    if (window.confirm(`Delete ${job.jobNo} "${job.title}"? This cannot be undone.`)) deleteJob(job.id);
  };

  const forReview = jobs.filter((j) => j.status === 'FOR REVIEW').length;

  return (
    <Page>
      <PageHeader
        title="Jobs"
        description="Pre-commissioning jobs for GPPSL. Each job is one data model: its drawings, markups, lists and calculations are all generated from it, so they always agree."
        actions={
          <>
            <Button onClick={startDemo}>
              <PlayCircle size={16} />
              Demo mode
            </Button>
            <Button variant="primary" onClick={newJob}>
              <Plus size={16} />
              New job
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Jobs" value={jobs.length} />
        <Stat label="For review" value={forReview} hint="Awaiting engineer approval" />
        <Stat label="Approved" value={jobs.length - forReview} />
        <Stat label="Pipeline under test" value={`${fmtNumber(totalLengthKm(jobs), 1)} km`} hint="Across all test sections" />
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <h2 className="text-base font-semibold text-ink">No jobs yet</h2>
          <p className="mt-1 text-sm text-muted">Create a job, or restore the two demo jobs.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="primary" onClick={newJob}>
              <Plus size={16} />
              New job
            </Button>
            <Button onClick={resetDemoData}>
              <RotateCcw size={15} />
              Restore demo jobs
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} flag={flags.get(job.id) ?? null} onDelete={() => confirmDelete(job)} />
          ))}
        </div>
      )}
    </Page>
  );
}

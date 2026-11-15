import { BadgeCheck, CircleAlert, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { JobCalc } from '@/calc';
import type { Job } from '@/model/types';
import { jobPath } from '@/navigation';
import { useJobStore } from '@/store/jobStore';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Page';

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Engineer approval: name and time stamped into every title block, watermark removed. */
export function ApprovalCard({ job, calc }: { job: Job; calc: JobCalc }) {
  const approveJob = useJobStore((s) => s.approveJob);
  const withdrawApproval = useJobStore((s) => s.withdrawApproval);
  const [name, setName] = useState('');
  const red = calc.sections.filter((s) => s.flag?.flag === 'RED').map((s) => s.name);
  const drafts = job.markups.filter((m) => m.aiDraft).length;

  if (job.status === 'APPROVED') {
    return (
      <Card className="overflow-hidden">
        <CardHeader title="Engineer approval" />
        <div className="space-y-3 p-5">
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3.5 ring-1 ring-emerald-600/20 scada:bg-[#00E87B]/10 scada:ring-[#00E87B]/30">
            <BadgeCheck size={22} className="mt-0.5 shrink-0 text-emerald-600 scada:text-[#00E87B]" />
            <div className="text-sm">
              <div className="font-semibold text-emerald-800 scada:text-[#00E87B]" data-testid="approved-by">
                Approved by {job.approvedBy}
              </div>
              <div className="text-emerald-700 scada:text-emerald-200">
                {job.approvedAt ? stamp(job.approvedAt) : ''} · Revision {job.revision}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted">Every title block shows APPROVED with this name and date, and the watermark is removed.</p>
          <Button
            size="sm"
            onClick={() => window.confirm('Withdraw the approval and send this revision back to FOR REVIEW?') && withdrawApproval(job.id)}
          >
            <Undo2 size={14} />
            Withdraw approval
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Engineer approval" description={`Revision ${job.revision} is FOR REVIEW.`} />
      <form
        className="space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && drafts === 0) approveJob(job.id, name);
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-muted uppercase">Engineer name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. A. Okafor"
            aria-label="Engineer name"
            className="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        {red.length > 0 && (
          <p className="flex gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 scada:bg-red-500/10 scada:text-red-300">
            <CircleAlert size={14} className="mt-0.5 shrink-0" />
            {red.join(', ')} {red.length === 1 ? 'is' : 'are'} flagged RED. Approve only once the engineer has resolved it.
          </p>
        )}
        {drafts > 0 && (
          <p className="flex gap-2 rounded-md bg-ai-draft/10 px-3 py-2 text-xs text-ink ring-1 ring-ai-draft/30" data-testid="drafts-block-approval">
            <CircleAlert size={14} className="mt-0.5 shrink-0 text-ai-draft" />
            <span>
              {drafts === 1 ? '1 markup is an AI draft' : `${drafts} markups are AI drafts`} not yet accepted. Check and accept them in the{' '}
              <Link to={jobPath(job.id, 'markup')} className="font-medium text-primary hover:underline">
                Markup studio
              </Link>{' '}
              before approving.
            </span>
          </p>
        )}
        <p className="text-xs text-muted">Stamps your name and the time into every title block and removes the FOR REVIEW watermark.</p>
        <Button type="submit" variant="primary" className="w-full" disabled={!name.trim() || drafts > 0}>
          <BadgeCheck size={15} />
          Approve revision {job.revision}
        </Button>
      </form>
    </Card>
  );
}

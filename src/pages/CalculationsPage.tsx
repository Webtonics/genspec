import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { calculateJob } from '@/calc';
import { JobPageHeader } from '@/components/JobPageHeader';
import { CalcBasisCard } from '@/components/calc/CalcBasisCard';
import { SectionCalcCard } from '@/components/calc/SectionCalcCard';
import { SummaryTable } from '@/components/calc/SummaryTable';
import { buttonClass } from '@/components/ui/Button';
import { FlagChip } from '@/components/ui/FlagChip';
import { Page } from '@/components/ui/Page';
import { useCurrentJob } from '@/hooks/useCurrentJob';
import { jobPath } from '@/navigation';
import { useRules } from '@/store/settingsStore';

export function CalculationsPage() {
  const job = useCurrentJob();
  const rules = useRules();
  const calc = useMemo(() => calculateJob(job, rules), [job, rules]);
  const isWater = job.medium === 'inhibited water';

  return (
    <Page>
      <JobPageHeader
        job={job}
        pageKey="calculations"
        actions={
          job.sections.length > 0 && (
            <span className="flex items-center gap-2 text-xs text-muted">
              Overall
              <FlagChip flag={calc.worst} />
            </span>
          )
        }
      />

      {job.sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <h2 className="text-base font-semibold text-ink">No test sections yet</h2>
          <p className="mt-1 text-sm text-muted">Add test sections in Job setup and their calculations appear here.</p>
          <Link to={jobPath(job.id, 'setup')} className={`${buttonClass('primary')} mt-5`}>
            Go to Job setup
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <CalcBasisCard job={job} calc={calc} />
          <SummaryTable job={job} calc={calc} />
          {job.sections.map((section, i) => (
            <SectionCalcCard key={section.id} section={section} calc={calc.sections[i]} isWater={isWater} />
          ))}
          <p className="text-xs leading-relaxed text-muted">
            Every number comes from deterministic formulas and the rule tables in Settings. Values are calculated at full
            precision and rounded for display. Results are for engineering review and must be checked before use.
          </p>
        </div>
      )}
    </Page>
  );
}

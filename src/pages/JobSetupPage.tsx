import { CircleAlert, Plus, Trash } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { calculateJob } from '@/calc';
import { JobPageHeader } from '@/components/JobPageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { FlagChip } from '@/components/ui/FlagChip';
import { NumberInput, TextInput } from '@/components/ui/NumberInput';
import { Card, CardHeader, Page } from '@/components/ui/Page';
import { useCurrentJob } from '@/hooks/useCurrentJob';
import { cx } from '@/lib/cx';
import { fmtNumber, fmtValue } from '@/lib/format';
import { MEDIA, MEDIUM_LABELS, TEST_CODES, TEST_CODE_LABELS } from '@/model/options';
import type { Medium, TestCode, TestSection } from '@/model/types';
import { jobPath } from '@/navigation';
import { standardOd } from '@/rules/pipeSizes';
import { useJobStore } from '@/store/jobStore';
import { useRules } from '@/store/settingsStore';

const select =
  'h-9 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20';

function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

type NumericKey = Exclude<keyof TestSection, 'id' | 'name'>;

const COLUMNS: { key: NumericKey; label: string; unit: string; min?: number; exclusiveMin?: boolean; width: string }[] = [
  { key: 'nps', label: 'NPS', unit: 'in', min: 0, exclusiveMin: true, width: 'w-16' },
  { key: 'odMm', label: 'OD', unit: 'mm', min: 0, exclusiveMin: true, width: 'w-20' },
  { key: 'wtMm', label: 'WT', unit: 'mm', min: 0, exclusiveMin: true, width: 'w-16' },
  { key: 'lengthM', label: 'Length', unit: 'm', min: 0, exclusiveMin: true, width: 'w-24' },
  { key: 'designPressureBarg', label: 'Design', unit: 'barg', min: 0, width: 'w-20' },
  { key: 'maxAllowableTestBarg', label: 'Max test', unit: 'barg', min: 0, width: 'w-20' },
  { key: 'highPointElevM', label: 'High pt EL', unit: 'm', width: 'w-20' },
  { key: 'lowPointElevM', label: 'Low pt EL', unit: 'm', width: 'w-20' },
  { key: 'holdHours', label: 'Hold', unit: 'h', min: 0, width: 'w-16' },
];

export function JobSetupPage() {
  const job = useCurrentJob();
  const rules = useRules();
  const updateJob = useJobStore((s) => s.updateJob);
  const addSection = useJobStore((s) => s.addSection);
  const updateSection = useJobStore((s) => s.updateSection);
  const removeSection = useJobStore((s) => s.removeSection);
  const calc = useMemo(() => calculateJob(job, rules), [job, rules]);

  const setNumber = (section: TestSection, key: NumericKey, value: number | null) => {
    if (value === null) return;
    if (key === 'nps') {
      const od = standardOd(value);
      updateSection(job.id, section.id, od !== undefined ? { nps: value, odMm: od } : { nps: value });
    } else {
      updateSection(job.id, section.id, { [key]: value });
    }
  };

  const confirmRemove = (section: TestSection) => {
    const assigned = job.markups.filter((m) => m.sectionId === section.id).length;
    const warning = assigned ? ` ${assigned} ${assigned === 1 ? 'markup is' : 'markups are'} assigned to it and will become unassigned.` : '';
    if (window.confirm(`Remove ${section.name}?${warning}`)) removeSection(job.id, section.id);
  };

  return (
    <Page>
      <JobPageHeader job={job} pageKey="setup" />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Job details" description="Saved as you type. The job number, client and title appear in every title block." />
          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Job title" className="md:col-span-2 xl:col-span-1">
              <TextInput value={job.title} aria-label="Job title" className="h-9 w-full" onChange={(title) => updateJob(job.id, { title })} />
            </Field>
            <Field label="Client">
              <TextInput value={job.client} aria-label="Client" className="h-9 w-full" onChange={(client) => updateJob(job.id, { client })} />
            </Field>
            <Field label="Job number">
              <TextInput value={job.jobNo} aria-label="Job number" className="h-9 w-full font-mono" onChange={(jobNo) => updateJob(job.id, { jobNo })} />
            </Field>
            <Field label="Test medium">
              <select className={select} value={job.medium} aria-label="Test medium" onChange={(e) => updateJob(job.id, { medium: e.target.value as Medium })}>
                {MEDIA.map((m) => (
                  <option key={m} value={m}>
                    {MEDIUM_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Governing code" hint={<Link to="/settings" className="text-primary hover:underline">Test factors and hold periods in Settings</Link>}>
              <select className={select} value={job.code} aria-label="Governing code" onChange={(e) => updateJob(job.id, { code: e.target.value as TestCode })}>
                {TEST_CODES.map((c) => (
                  <option key={c} value={c}>
                    {TEST_CODE_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Revision" hint="Raised by client comments on the Test pack page.">
              <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-line px-2.5 text-sm text-ink">
                <span className="font-mono font-semibold">{job.revision}</span>
                <span className="text-muted">·</span>
                <span className="text-muted">{job.status === 'APPROVED' ? `Approved by ${job.approvedBy}` : 'For review'}</span>
              </div>
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Test sections"
            description="Each section is tested on its own. Edits flow straight into the calculations, lists, spread diagrams and test pack."
            actions={
              <Button onClick={() => addSection(job.id)}>
                <Plus size={15} />
                Add section
              </Button>
            }
          />
          {job.sections.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-ink">No test sections yet</p>
              <p className="mt-1 text-sm text-muted">Add the first section to start the calculations.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-left text-xs font-semibold text-muted">
                    <th className="py-2.5 pr-2 pl-5">Section</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="px-1 py-2.5 whitespace-nowrap">
                        {c.label} <span className="font-normal">({c.unit})</span>
                      </th>
                    ))}
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {job.sections.map((s, i) => {
                    const result = calc.sections[i];
                    return (
                      <tr key={s.id} className="border-b border-line align-top last:border-0" data-section={s.name}>
                        <td className="py-2 pr-2 pl-5">
                          <TextInput
                            value={s.name}
                            aria-label="Section name"
                            className="h-8 w-24 font-mono font-semibold"
                            onChange={(name) => updateSection(job.id, s.id, { name })}
                          />
                          <Link
                            to={jobPath(job.id, 'calculations')}
                            title="Open the calculations"
                            className="mt-1.5 flex items-center gap-2 text-xs whitespace-nowrap text-muted tabular-nums hover:text-ink"
                            data-testid="section-result"
                          >
                            <FlagChip flag={result.flag?.flag ?? null} />
                            {result.values.volumeM3 !== undefined ? `${fmtNumber(result.values.volumeM3, 1)} m³` : 'n/a'}
                          </Link>
                          {result.issues.length > 0 && (
                            <div className="mt-1.5 flex max-w-[60ch] gap-1.5 text-xs text-amber-700 scada:text-[#FFB020]" style={{ width: 'max-content' }}>
                              <CircleAlert size={13} className="mt-0.5 shrink-0" />
                              {result.issues[0]}
                              {result.issues.length > 1 ? ` (+${result.issues.length - 1} more)` : ''}
                            </div>
                          )}
                        </td>
                        {COLUMNS.map((c) => (
                          <td key={c.key} className="px-1 py-2">
                            <NumberInput
                              value={s[c.key]}
                              min={c.min}
                              exclusiveMin={c.exclusiveMin}
                              aria-label={`${c.label} for ${s.name}`}
                              className={c.width}
                              onChange={(v) => setNumber(s, c.key, v)}
                            />
                            {c.key === 'odMm' && standardOd(s.nps) === s.odMm && (
                              <div className="mt-1 text-[10px] text-muted">B36.10M</div>
                            )}
                          </td>
                        ))}
                        <td className="py-2 pr-4 text-right">
                          <IconButton variant="danger" aria-label={`Remove ${s.name}`} title="Remove section" onClick={() => confirmRemove(s)}>
                            <Trash size={15} />
                          </IconButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Choosing an NPS fills in the standard outside diameter from ASME B36.10M; override it for non-standard pipe.
            Elevations are above the same datum. Test pressure at the high point is {job.code} factor{' '}
            {rules.testCodes[job.code].factor !== null ? fmtValue(rules.testCodes[job.code].factor ?? 0) : '(not set)'} times design.
          </p>
        </Card>
      </div>
    </Page>
  );
}

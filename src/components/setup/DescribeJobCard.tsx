import { Check, CircleAlert, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { parseJob, useAiStatus } from '@/ai/client';
import { type DraftPlan, type FieldChange, applyPlan, countSelected, defaultSelection, planDraft } from '@/ai/jobDraft';
import { cx } from '@/lib/cx';
import { fmtValue, plural } from '@/lib/format';
import type { Job } from '@/model/types';
import { useJobStore } from '@/store/jobStore';
import { useRules } from '@/store/settingsStore';
import { AiBadge, AiErrorNotice, AiOffNotice } from '../ai/AiPieces';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Page';

const EXAMPLE =
  'Hydrotest of the new 8 inch gas lift line GL-202 for Delta Export Co., test section TP-021. ' +
  '3.4 km of 8" pipe, wall 0.322 in, design pressure 1,440 psig to ASME B31.8. ' +
  'High point 22 m and low point 4 m above datum. Maximum allowable test pressure 140 barg. ' +
  'Hold 8 hours, test medium inhibited water.';

const MAX_CHARS = 4000;

type Phase = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; error: unknown } | { kind: 'review'; plan: DraftPlan; model: string };

export function DescribeJobCard({ job }: { job: Job }) {
  const status = useAiStatus();
  const rules = useRules();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<string | null>(null);

  const draft = async () => {
    setPhase({ kind: 'busy' });
    setApplied(null);
    try {
      const res = await parseJob(text);
      const plan = planDraft(job, res.extraction, rules);
      setSelected(defaultSelection(plan));
      setPhase({ kind: 'review', plan, model: res.model });
    } catch (error) {
      setPhase({ kind: 'error', error });
    }
  };

  const apply = (plan: DraftPlan) => {
    const store = useJobStore.getState();
    const result = applyPlan(plan, selected);
    const n = countSelected(plan, selected);
    if (Object.keys(result.jobPatch).length) store.updateJob(job.id, result.jobPatch);
    for (const u of result.updates) store.updateSection(job.id, u.sectionId, u.patch);
    for (const a of result.additions) store.addSection(job.id, { ...a.values, name: a.name });
    setPhase({ kind: 'idle' });
    setApplied(`Applied ${plural(n, 'change')}. The job stays FOR REVIEW until an engineer approves it.`);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card data-tour="describe-job">
      <CardHeader
        title="Describe the job"
        description="Write the job in plain English. AI drafts the fields for you to check; nothing changes until you apply it."
        actions={<AiBadge />}
      />
      <div className="p-5">
        {status === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
        ) : !status.enabled ? (
          <AiOffNotice />
        ) : (
          <>
            <textarea
              value={text}
              rows={3}
              maxLength={MAX_CHARS}
              aria-label="Job description"
              placeholder={`For example: ${EXAMPLE}`}
              onChange={(e) => setText(e.target.value)}
              className="block w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink outline-none placeholder:text-muted/70 hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={draft} disabled={!text.trim() || phase.kind === 'busy'} data-testid="draft-job">
                {phase.kind === 'busy' ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {phase.kind === 'busy' ? 'Reading the description' : 'Draft with AI'}
              </Button>
              {!text && (
                <Button variant="ghost" size="sm" onClick={() => setText(EXAMPLE)}>
                  Use the example
                </Button>
              )}
              <span className="ml-auto text-xs text-muted">
                The AI only reads the text. Unit conversions and every calculation run in GenSpec.
              </span>
            </div>
            {applied && (
              <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700 scada:text-[#00E87B]" data-testid="draft-applied">
                <Check size={15} />
                {applied}
              </p>
            )}
            {phase.kind === 'error' && (
              <div className="mt-4">
                <AiErrorNotice error={phase.error} onRetry={draft} />
              </div>
            )}
            {phase.kind === 'review' && (
              <DraftReview
                plan={phase.plan}
                model={phase.model}
                job={job}
                selected={selected}
                onToggle={toggle}
                onApply={() => apply(phase.plan)}
                onDiscard={() => setPhase({ kind: 'idle' })}
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

const th = 'px-2 py-2 text-left text-[11px] font-semibold tracking-wider text-muted uppercase';
const td = 'px-2 py-2 align-top';

function Tick({ id, checked, disabled, onToggle, label }: { id: string; checked: boolean; disabled?: boolean; onToggle: (id: string) => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={() => onToggle(id)}
      className="mt-0.5 size-4 cursor-pointer accent-[var(--app-primary)] disabled:cursor-default disabled:opacity-40"
    />
  );
}

function Unchanged() {
  return <span className="text-xs text-muted">No change</span>;
}

function ProposalCell({ change, isNew }: { change: FieldChange; isNew: boolean }) {
  const p = change.proposal;
  return (
    <>
      <div className={cx('font-mono tabular-nums', change.same && !isNew ? 'text-muted' : 'font-semibold text-ink')}>
        {fmtValue(p.value)} {change.unit}
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {p.origin === 'rule' ? (
          <span className="mr-1 rounded bg-surface-2 px-1 py-px text-[10px] font-semibold tracking-wide uppercase ring-1 ring-line">Rule</span>
        ) : (
          <span>Text: "{p.source}". </span>
        )}
        {p.working}
        {p.note && <span className="block">{p.note}</span>}
      </div>
    </>
  );
}

function DraftReview({
  plan,
  model,
  job,
  selected,
  onToggle,
  onApply,
  onDiscard,
}: {
  plan: DraftPlan;
  model: string;
  job: Job;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const n = countSelected(plan, selected);
  const empty = plan.job.length === 0 && plan.sections.length === 0;
  return (
    <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/40 scada:border-[#FFB020]/30 scada:bg-[#FFB020]/5" data-testid="draft-review">
      <div className="flex flex-wrap items-start gap-3 border-b border-violet-200 px-4 py-3 scada:border-[#FFB020]/20">
        <AiBadge />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-ink">Drafted by AI from your description. Check every value before applying.</p>
          <p className="mt-0.5 text-xs text-muted">
            Read by {model}. Ticked rows are applied; untick anything you do not want. Calculations then run from the applied values.
          </p>
        </div>
      </div>

      <div className="space-y-5 bg-surface px-4 py-4">
        {empty && <p className="text-sm text-muted">The description did not contain job or section data. Add sizes, lengths, pressures or elevations and try again.</p>}

        {plan.job.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="w-8" />
                <th className={th}>Job field</th>
                <th className={th}>Current</th>
                <th className={th}>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {plan.job.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className={td}>
                    <Tick id={c.id} checked={selected.has(c.id)} disabled={c.same} onToggle={onToggle} label={`Apply ${c.label}`} />
                  </td>
                  <td className={cx(td, 'font-medium text-ink')}>{c.label}</td>
                  <td className={cx(td, 'text-muted')}>{c.current || <em>empty</em>}</td>
                  <td className={td}>{c.same ? <Unchanged /> : <span className="font-semibold text-ink">{c.display}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {plan.sections.map((s) => {
          const isNew = s.target.kind === 'new';
          const existing = s.target.kind === 'update' ? job.sections.find((x) => x.id === (s.target as { sectionId: string }).sectionId) : undefined;
          return (
            <div key={s.id} data-testid="draft-section">
              <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                <span className="font-mono">{s.rename ? s.rename.to : s.target.name}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">
                  {isNew ? 'New section' : `Updates ${existing?.name ?? s.target.name}`}
                </span>
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="w-8" />
                    <th className={th}>Field</th>
                    {!isNew && <th className={th}>Current</th>}
                    <th className={th}>Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rename && (
                    <tr className="border-b border-line">
                      <td className={td}>
                        <Tick id={s.rename.id} checked={selected.has(s.rename.id)} onToggle={onToggle} label="Apply section name" />
                      </td>
                      <td className={cx(td, 'font-medium text-ink')}>Section name</td>
                      <td className={cx(td, 'font-mono text-muted')}>{s.rename.from}</td>
                      <td className={cx(td, 'font-mono font-semibold text-ink')}>{s.rename.to}</td>
                    </tr>
                  )}
                  {s.changes.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0" data-field={c.key}>
                      <td className={td}>
                        <Tick
                          id={c.id}
                          checked={selected.has(c.id)}
                          disabled={c.same && !isNew}
                          onToggle={onToggle}
                          label={`Apply ${c.label}`}
                        />
                      </td>
                      <td className={cx(td, 'font-medium whitespace-nowrap text-ink')}>{c.label}</td>
                      {!isNew && (
                        <td className={cx(td, 'font-mono whitespace-nowrap text-muted tabular-nums')}>
                          {c.current !== null ? `${fmtValue(c.current)} ${c.unit}` : ''}
                        </td>
                      )}
                      <td className={td}>{c.same && !isNew ? <Unchanged /> : <ProposalCell change={c} isNew={isNew} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.missing.length > 0 && (
                <p className="mt-2 flex gap-1.5 text-xs text-amber-800 scada:text-[#FFB020]">
                  <CircleAlert size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Not in the description: {s.missing.map((m) => m.label.toLowerCase()).join(', ')}.{' '}
                    {isNew ? 'These start at the blank-section defaults; enter them before relying on the results.' : 'These keep their current values.'}
                  </span>
                </p>
              )}
              {s.notes.map((note) => (
                <p key={note} className="mt-1 flex gap-1.5 text-xs text-amber-800 scada:text-[#FFB020]">
                  <CircleAlert size={13} className="mt-0.5 shrink-0" />
                  {note}
                </p>
              ))}
            </div>
          );
        })}

        {plan.notes.length > 0 && (
          <div>
            <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Notes from the AI</h3>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink">
              {plan.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-violet-200 px-4 py-3 scada:border-[#FFB020]/20">
        <Button variant="ghost" onClick={onDiscard}>
          <X size={15} />
          Discard
        </Button>
        <Button variant="primary" onClick={onApply} disabled={n === 0} data-testid="apply-draft">
          <Check size={15} />
          {n === 0 ? 'Nothing to apply' : `Apply ${plural(n, 'change')}`}
        </Button>
      </div>
    </div>
  );
}

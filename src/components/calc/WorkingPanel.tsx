import type { CalcGroup, CalcStep } from '@/calc';
import { fmtNumber } from '@/lib/format';

function StepRow({ step }: { step: CalcStep }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[10.5rem_minmax(0,1fr)_auto]">
      <div className="text-sm font-medium leading-snug text-ink">{step.label}</div>
      <div className="col-span-2 row-start-2 min-w-0 font-mono text-xs leading-relaxed sm:col-span-1 sm:row-start-auto">
        <div className="text-ink">{step.formula}</div>
        <div className="text-muted">= {step.substitution}</div>
        {step.note && <div className="mt-1 font-sans text-xs text-muted">{step.note}</div>}
      </div>
      <div className="whitespace-nowrap text-right">
        <span className="text-[15px] font-semibold tabular-nums text-ink">{fmtNumber(step.value, step.decimals)}</span>
        <span className="ml-1 text-xs text-muted">{step.unit}</span>
      </div>
    </div>
  );
}

/** One block of working: each step shows the formula, the substituted values and the result. */
export function WorkingPanel({ group }: { group: CalcGroup }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{group.title}</h3>
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {group.steps.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </div>
      {group.notes.map((note) => (
        <p key={note} className="mt-2 text-xs text-muted">
          {note}
        </p>
      ))}
    </section>
  );
}

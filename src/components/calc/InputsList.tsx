import type { CalcInput } from '@/calc';
import { cx } from '@/lib/cx';
import { fmtMinutes, fmtValue } from '@/lib/format';
import { RULE_DEFAULT_LABEL } from '@/rules';

const SOURCE_CHIP = 'whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset';

function SourceChip({ input }: { input: CalcInput }) {
  if (input.source === 'section') {
    return <span className={cx(SOURCE_CHIP, 'text-muted ring-line')}>Job setup</span>;
  }
  if (input.source === 'job') {
    return (
      <span className={cx(SOURCE_CHIP, 'bg-blue-50 text-blue-700 ring-blue-600/20 scada:bg-primary/10 scada:text-primary scada:ring-primary/30')}>
        This job
      </span>
    );
  }
  return input.ruleDefault ? (
    <span className={cx(SOURCE_CHIP, 'bg-slate-100 text-slate-600 ring-slate-300 scada:bg-white/5 scada:text-muted scada:ring-line-strong')}>
      {RULE_DEFAULT_LABEL}
    </span>
  ) : (
    <span className={cx(SOURCE_CHIP, 'bg-blue-50 text-blue-700 ring-blue-600/20 scada:bg-primary/10 scada:text-primary scada:ring-primary/30')}>
      Settings
    </span>
  );
}

function displayValue(input: CalcInput): string {
  if (input.value === null) return input.key === 'minHold' ? 'Per client' : 'Not set';
  if (input.key === 'minHold') return fmtMinutes(input.value);
  return `${fmtValue(input.value)} ${input.unit}`;
}

/** Every input the calculation used, with its symbol and where it came from. */
export function InputsList({ inputs }: { inputs: CalcInput[] }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Inputs</h3>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {inputs.map((input) => (
          <li key={input.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-2">
            <div className="min-w-0">
              <div className="text-sm leading-snug text-ink">{input.label}</div>
              <div className="font-mono text-[11px] text-muted">{input.symbol}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">{displayValue(input)}</span>
              <SourceChip input={input} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

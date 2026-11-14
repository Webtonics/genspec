import { Info, RotateCcw } from 'lucide-react';
import { cx } from '@/lib/cx';
import { RULE_DEFAULT_LABEL } from '@/rules';

const chip = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset';

/**
 * Status of a rule value: still the shipped default ("Default, confirm with
 * engineer"), edited (with a reset), or missing (must be entered).
 */
export function RuleStatus({
  isDefault,
  missing,
  defaultText,
  onReset,
}: {
  isDefault: boolean;
  /** The value is required but empty, e.g. a client spec factor. */
  missing?: string;
  defaultText?: string;
  onReset?: () => void;
}) {
  if (missing) {
    return (
      <span className={cx(chip, 'bg-amber-50 text-amber-800 ring-amber-600/25 scada:bg-[#FFB020]/10 scada:text-[#FFB020] scada:ring-[#FFB020]/30')}>
        {missing}
      </span>
    );
  }
  if (isDefault) {
    return (
      <span className={cx(chip, 'bg-slate-100 text-slate-600 ring-slate-300 scada:bg-white/5 scada:text-muted scada:ring-line-strong')}>
        <Info size={12} aria-hidden />
        {RULE_DEFAULT_LABEL}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cx(chip, 'bg-blue-50 text-blue-700 ring-blue-600/20 scada:bg-primary/10 scada:text-primary scada:ring-primary/30')}>
        Edited{defaultText ? `, default ${defaultText}` : ''}
      </span>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="grid size-6 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Reset to default"
          title="Reset to default"
        >
          <RotateCcw size={12} />
        </button>
      )}
    </span>
  );
}

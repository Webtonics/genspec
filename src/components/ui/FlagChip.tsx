import type { Flag } from '@/calc';
import { cx } from '@/lib/cx';

const CHIP: Record<Flag | 'INCOMPLETE', { chip: string; dot: string }> = {
  RED: {
    chip: 'bg-red-50 text-red-700 ring-red-600/25 scada:bg-red-500/10 scada:text-red-400 scada:ring-red-400/30',
    dot: 'bg-red-600 scada:bg-red-400',
  },
  AMBER: {
    chip: 'bg-amber-50 text-amber-800 ring-amber-600/30 scada:bg-[#FFB020]/10 scada:text-[#FFB020] scada:ring-[#FFB020]/30',
    dot: 'bg-amber-500 scada:bg-[#FFB020]',
  },
  GREEN: {
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/25 scada:bg-[#00E87B]/10 scada:text-[#00E87B] scada:ring-[#00E87B]/30',
    dot: 'bg-emerald-500 scada:bg-[#00E87B]',
  },
  INCOMPLETE: {
    chip: 'bg-slate-100 text-slate-600 ring-slate-400/30 scada:bg-white/5 scada:text-muted scada:ring-line-strong',
    dot: 'bg-slate-400 scada:bg-muted',
  },
};

/** SVG text fill for a flag, matching the chip colours in both display modes. */
export const FLAG_FILL: Record<Flag, string> = {
  RED: 'fill-red-600 scada:fill-red-400',
  AMBER: 'fill-amber-600 scada:fill-[#FFB020]',
  GREEN: 'fill-emerald-600 scada:fill-[#00E87B]',
};

/** Left border and tint for a flag message banner. */
export const FLAG_BANNER: Record<Flag, string> = {
  RED: 'border-red-600 bg-red-50 text-red-900 scada:border-red-400 scada:bg-red-500/10 scada:text-red-200',
  AMBER: 'border-amber-500 bg-amber-50 text-amber-900 scada:border-[#FFB020] scada:bg-[#FFB020]/10 scada:text-amber-100',
  GREEN:
    'border-emerald-500 bg-emerald-50 text-emerald-900 scada:border-[#00E87B] scada:bg-[#00E87B]/10 scada:text-emerald-100',
};

export function FlagChip({ flag, className }: { flag: Flag | null; className?: string }) {
  const key = flag ?? 'INCOMPLETE';
  const style = CHIP[key];
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5',
        'text-[11px] font-bold tracking-wide ring-1 ring-inset',
        style.chip,
        className,
      )}
      title={flag ? undefined : 'Some inputs are missing, so this could not be flagged'}
    >
      <span className={cx('size-1.5 rounded-full', style.dot)} aria-hidden />
      {key}
    </span>
  );
}

import { cx } from '@/lib/cx';
import type { JobStatus } from '@/model/types';

const STYLES: Record<JobStatus, { chip: string; dot: string }> = {
  'FOR REVIEW': {
    chip: 'bg-amber-50 text-amber-800 ring-amber-600/25 scada:bg-[#FFB020]/10 scada:text-[#FFB020] scada:ring-[#FFB020]/30',
    dot: 'bg-amber-500 scada:bg-[#FFB020]',
  },
  APPROVED: {
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 scada:bg-[#00E87B]/10 scada:text-[#00E87B] scada:ring-[#00E87B]/30',
    dot: 'bg-emerald-500 scada:bg-[#00E87B]',
  },
};

export function StatusChip({ status, className }: { status: JobStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5',
        'text-[11px] font-semibold tracking-wide ring-1 ring-inset',
        style.chip,
        className,
      )}
    >
      <span className={cx('size-1.5 rounded-full', style.dot)} aria-hidden />
      {status}
    </span>
  );
}

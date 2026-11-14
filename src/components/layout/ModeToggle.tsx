import { cx } from '@/lib/cx';
import { type DisplayMode, useUiStore } from '@/store/uiStore';

const MODES: { mode: DisplayMode; label: string; swatch: string }[] = [
  { mode: 'engineering', label: 'Engineering', swatch: 'bg-white ring-1 ring-slate-400' },
  { mode: 'scada', label: 'SCADA', swatch: 'bg-[#0B0F0E] ring-1 ring-[#00E87B]' },
];

export function ModeToggle() {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);

  return (
    <div role="group" aria-label="Display mode" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {MODES.map((m) => {
        const active = mode === m.mode;
        return (
          <button
            key={m.mode}
            type="button"
            aria-pressed={active}
            onClick={() => setMode(m.mode)}
            className={cx(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-primary',
              active ? 'bg-surface text-ink shadow-sm ring-1 ring-line scada:text-primary' : 'text-muted hover:text-ink',
            )}
          >
            <span className={cx('size-2.5 rounded-full', m.swatch)} aria-hidden />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
